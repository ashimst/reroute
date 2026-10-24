"""
POST /api/chat  — conversational endpoint with SSE streaming.

Flow:
  1. System-1 router (keyword + noul confidence) decides the intent:
       • tool_execution  → run REROUTE graph, then narrate result via Groq
       • chat            → send conversation directly to Groq

  2. All responses are streamed back as Server-Sent Events so the
     frontend can display tokens as they arrive.

SSE format: each event is a JSON line prefixed with "data: "
  data: {"type":"intent",      "content": {...}}
  data: {"type":"tool_start",  "content": null}
  data: {"type":"tool_result", "content": {...}}   ← full CaseResponse
  data: {"type":"text",        "content": "..."}   ← Groq token chunk
  data: {"type":"done",        "content": null}
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys
import uuid
from pathlib import Path
from typing import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, IntentDecision
from app.routers.cases import _build_response, _clean_state

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

# ── Add reroute/ to path (redundant but safe) ─────────────────────────────────
_REROUTE = Path(__file__).resolve().parents[4] / "reroute"
if str(_REROUTE) not in sys.path:
    sys.path.insert(0, str(_REROUTE))


# ─────────────────────────────────────────────────────────────────────────────
# System-1 intent router
# ─────────────────────────────────────────────────────────────────────────────

# Strong exception-action signals → tool_execution
_TOOL_KEYWORDS = {
    # returns
    "refund", "return", "damaged", "broken", "smashed", "defective",
    "wrong item", "incorrect item", "not what i ordered", "missing item",
    "didn't receive", "not in box",
    # delivery
    "late delivery", "not arrived", "hasn't arrived", "where is my order",
    "tracking", "lost package", "shipped but not received", "in transit",
    "package not delivered", "marked delivered",
    # payment
    "charged twice", "double charged", "duplicate charge", "overcharged",
    "payment failed", "billing issue", "payment not processed",
}

# ORDER_ID pattern — 32-char hex
_ORDER_RE = re.compile(r"\b([0-9a-f]{32})\b", re.IGNORECASE)


def _extract_order_id(text: str) -> str | None:
    m = _ORDER_RE.search(text)
    return m.group(1).lower() if m else None


def _system1_intent(last_user_message: str, provided_order_id: str | None) -> IntentDecision:
    """
    Fast keyword-based System-1 decision.
    Returns tool_execution if:
      - message contains an exception keyword AND
      - an order ID is available (provided or extracted from message)
    Otherwise returns chat.
    """
    text = last_user_message.lower()
    detected_id = _extract_order_id(last_user_message)
    order_id = detected_id or provided_order_id

    keyword_hits = sum(1 for kw in _TOOL_KEYWORDS if kw in text)
    total_words = len(text.split())
    density = keyword_hits / max(total_words, 1)

    # Need both: exception signal + an order ID to run tools
    if keyword_hits >= 1 and order_id:
        confidence = min(0.5 + keyword_hits * 0.15 + density * 0.5, 1.0)
        return IntentDecision(
            intent="tool_execution",
            confidence=round(confidence, 2),
            detected_order_id=order_id,
            reason=f"{keyword_hits} exception keyword(s) detected + order ID present",
        )

    # No order ID but exception keywords → ask for order ID (still chat)
    if keyword_hits >= 1 and not order_id:
        return IntentDecision(
            intent="chat",
            confidence=0.7,
            detected_order_id=None,
            reason="Exception keywords found but no order ID — will ask customer",
        )

    return IntentDecision(
        intent="chat",
        confidence=0.9,
        detected_order_id=None,
        reason="General conversation — no exception keywords detected",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Groq streaming helpers
# ─────────────────────────────────────────────────────────────────────────────

_CHAT_SYSTEM = """\
You are REROUTE Assistant, an intelligent retail customer support AI for Retail Flow.
You help customers with their orders: returns, refunds, delivery issues, and payment problems.

When a customer has an order exception (damaged item, late delivery, etc.) you will receive
a structured tool result showing exactly what the exception engine decided. Narrate it clearly
and empathetically in 2-4 sentences. Do NOT invent policies or decisions.

For general questions, be helpful, concise, and friendly.
If a customer mentions an issue but hasn't given their order ID, ask for it politely.
Keep responses under 200 words unless a detailed explanation is genuinely needed."""


def _narrate_system_prompt() -> str:
    return (
        _CHAT_SYSTEM
        + "\n\nYou have just run the REROUTE exception engine. "
        "Narrate the result below clearly and empathetically in 2-4 sentences. "
        "Mention the policy rule ID if relevant. Keep it under 120 words."
    )


def _build_groq_messages(
    messages: list,
    system: str,
    extra_user: str | None = None,
) -> list[dict]:
    history = [{"role": "system", "content": system}]
    for m in messages:
        history.append({"role": m.role, "content": m.content})
    if extra_user:
        history.append({"role": "user", "content": extra_user})
    return history


async def _stream_groq(
    messages: list[dict],
    groq_client,
    model: str,
) -> AsyncIterator[str]:
    """Yield text chunks from Groq streaming API."""
    stream = await asyncio.to_thread(
        lambda: groq_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.6,
            max_tokens=400,
            stream=True,
        )
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# ─────────────────────────────────────────────────────────────────────────────
# SSE helpers
# ─────────────────────────────────────────────────────────────────────────────

def _sse(type_: str, content) -> str:
    return "data: " + json.dumps({"type": type_, "content": content}, default=str) + "\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# Main SSE generator
# ─────────────────────────────────────────────────────────────────────────────
async def _generate(body: ChatRequest, app_state) -> AsyncIterator[str]:
    from src.config import GROQ_API_KEY, GROQ_MODEL
    from groq import Groq

    groq_client = None
    if GROQ_API_KEY and GROQ_API_KEY.strip():
        try:
            groq_client = Groq(api_key=GROQ_API_KEY.strip())
        except Exception as exc:
            log.warning("[chat] Failed to initialize Groq client: %s", exc)

    last_user = next(
        (m.content for m in reversed(body.messages) if m.role == "user"), ""
    )

    # ── Step 1: System-1 intent decision ─────────────────────────────────────
    decision = _system1_intent(last_user, body.order_id)
    log.info("[chat] session=%s intent=%s conf=%.2f", body.session_id, decision.intent, decision.confidence)
    yield _sse("intent", decision.dict())

    result = None

    # ── Step 2a: tool_execution path ─────────────────────────────────────────
    if decision.intent == "tool_execution":
        order_id = decision.detected_order_id or body.order_id
        yield _sse("tool_start", {"order_id": order_id})

        try:
            run_case = app_state.run_case
            case_id = f"CHAT-{uuid.uuid4().hex[:8].upper()}"

            raw_state = await asyncio.to_thread(
                run_case, case_id, order_id, last_user
            )
            result = _build_response(_clean_state(raw_state))
            yield _sse("tool_result", result.dict())

            # Narrate the structured result via Groq streaming
            narration_context = (
                f"TOOL RESULT:\n"
                f"Order: {result.order_id}\n"
                f"Route: {result.route}\n"
                f"Resolution: {result.resolution}\n"
                f"Detail: {result.resolution_detail}\n"
                f"Escalated: {result.escalate}\n"
                f"Rules applied: {', '.join(result.applicable_rules)}\n"
                f"Refund: {'$' + str(result.refund_amount) if result.refund_amount else 'none'}\n\n"
                f"Now write a 2-4 sentence empathetic reply to the customer."
            )
            groq_msgs = _build_groq_messages(
                body.messages[:-1],   # history without last user msg
                _narrate_system_prompt(),
                extra_user=narration_context,
            )

        except Exception as exc:
            log.exception("[chat] tool_execution failed: %s", exc)
            yield _sse("error", {"message": str(exc)})
            # Fall through to chat mode with error context
            groq_msgs = _build_groq_messages(
                body.messages,
                _CHAT_SYSTEM + f"\n\nNote: the exception engine failed with: {exc}. "
                "Apologise and ask the customer to try again or contact human support.",
            )

    # ── Step 2b: chat path ───────────────────────────────────────────────────
    else:
        # Optionally inject order context if an order_id was provided
        order_context = ""
        if body.order_id:
            try:
                repo = app_state.repo
                order = repo.get_order(body.order_id)
                delivery = repo.get_delivery_status(body.order_id)
                if order:
                    order_context = (
                        f"\n\n[Order context loaded for {body.order_id}]\n"
                        f"Status: {order.get('order_status')}\n"
                        f"Purchased: {order.get('order_purchase_timestamp')}\n"
                        f"Delivered: {delivery.get('is_delivered') if delivery else 'unknown'}\n"
                        f"Late: {delivery.get('is_late') if delivery else 'unknown'}\n"
                    )
            except Exception:
                pass

        system = _CHAT_SYSTEM + order_context
        groq_msgs = _build_groq_messages(body.messages, system)

    # ── Step 3: stream Groq text or fallback narration ───────────────────────
    if groq_client is not None:
        try:
            async for chunk in _stream_groq(groq_msgs, groq_client, GROQ_MODEL):
                yield _sse("text", chunk)
        except Exception as exc:
            log.exception("[chat] Groq streaming failed: %s", exc)
            if result:
                yield _sse("text", f"Resolution for order #{result.order_id}: {result.resolution.upper()}. {result.resolution_detail or ''}")
            else:
                yield _sse("text", f"I'm here to assist with your order. (Note: LLM stream experienced an error: {exc})")
    else:
        # Graceful response when GROQ_API_KEY is not configured
        if result:
            yield _sse("text", f"For order #{result.order_id}, our resolution is **{result.resolution.upper()}**.\n\n{result.resolution_detail or 'Processed according to policy.'}")
        else:
            yield _sse("text", "Hello! I am REROUTE Assistant. Please provide your order ID (32 hex characters) and describe your issue with returns, delivery, or payment so I can inspect it.")

    yield _sse("done", None)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", summary="Conversational chat with SSE streaming")
async def chat(body: ChatRequest, request: Request):
    """
    Send a message and get a streaming SSE response.

    The System-1 router automatically decides whether to:
    - Run the full REROUTE exception engine (tool_execution)
    - Have a direct conversation via Groq LLM (chat)

    Returns Server-Sent Events. Each event is a JSON object with `type` and `content`.
    """
    return StreamingResponse(
        _generate(body, request.app.state),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
