"""
Groq fallback – LLM reasoning used ONLY when deterministic tools are insufficient.

Used in two situations:
  1. Routing confidence is too low (OpenJEV uncertain).
  2. Agent confidence is below RESOLUTION_CONFIDENCE_THRESHOLD.

The Groq model receives:
  - customer_message
  - relevant order information
  - retrieved policy text
  - current workflow state

It returns structured JSON that code then acts on.
Groq NEVER directly calls tools – all tool execution goes through the
approved Cactus Needle layer.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from src.config import GROQ_API_KEY, GROQ_MODEL, RESOLUTION_CONFIDENCE_THRESHOLD

log = logging.getLogger(__name__)

# ── Response schema ───────────────────────────────────────────────────────────
# Groq must return exactly this JSON shape; we validate and default if not.
_EXPECTED_KEYS = {"interpretation", "recommended_action", "confidence", "needs_human"}

_SYSTEM_PROMPT = """You are a retail order exception resolution assistant.
You receive a customer message, order data, and policy text.
You must respond ONLY with valid JSON matching this exact schema:
{
  "interpretation": "<one sentence: what is the customer's actual problem>",
  "recommended_action": "<one of: approve_return | approve_refund | deny_return | inform_customer | investigate | escalate_to_human>",
  "confidence": <float 0.0 to 1.0>,
  "needs_human": <true | false>
}
Do not include any text outside the JSON object.
Base your decision strictly on the provided policy text. Do not invent rules."""


def _build_user_prompt(
    customer_message: str,
    order_info: dict,
    policies: list[dict],
    workflow_state: dict,
) -> str:
    policy_text = "\n".join(
        f"[{p['policy_id']}] {p['policy_text']}" for p in policies
    )
    order_text = json.dumps(order_info, indent=2, default=str)

    return f"""CUSTOMER MESSAGE:
{customer_message}

ORDER INFORMATION:
{order_text}

RELEVANT POLICIES:
{policy_text}

CURRENT WORKFLOW STATE:
Route: {workflow_state.get('route', 'unknown')}
Agent result: {workflow_state.get('resolution', 'none')}
Agent confidence: {workflow_state.get('confidence', 'unknown')}

Based on the above, provide your JSON response."""


def _parse_response(content: str) -> dict:
    """Parse and validate Groq's JSON response, filling defaults if malformed."""
    try:
        # Strip markdown code fences if present
        clean = content.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(
                l for l in lines
                if not l.startswith("```")
            ).strip()
        data = json.loads(clean)
    except json.JSONDecodeError as exc:
        log.warning("Groq returned non-JSON response: %s", exc)
        return {
            "interpretation": "Could not parse LLM response.",
            "recommended_action": "escalate_to_human",
            "confidence": 0.0,
            "needs_human": True,
            "parse_error": str(exc),
        }

    # Fill missing keys with safe defaults
    result = {
        "interpretation": data.get("interpretation", "No interpretation provided."),
        "recommended_action": data.get("recommended_action", "escalate_to_human"),
        "confidence": float(data.get("confidence", 0.0)),
        "needs_human": bool(data.get("needs_human", True)),
    }

    # Clamp confidence
    result["confidence"] = max(0.0, min(1.0, result["confidence"]))

    return result


def call(
    customer_message: str,
    order_info: dict,
    policies: list[dict],
    workflow_state: dict,
) -> dict:
    """
    Call Groq for fallback reasoning.

    Returns:
        {
            "interpretation":      str,
            "recommended_action":  str,
            "confidence":          float,
            "needs_human":         bool,
            "groq_used":           True,
            "groq_model":          str,
            "error":               str | None,
        }
    """
    if not GROQ_API_KEY:
        log.error("GROQ_API_KEY not set. Cannot use Groq fallback.")
        return {
            "interpretation": "Groq API key not configured.",
            "recommended_action": "escalate_to_human",
            "confidence": 0.0,
            "needs_human": True,
            "groq_used": True,
            "groq_model": GROQ_MODEL,
            "error": "GROQ_API_KEY not set",
        }

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        user_prompt = _build_user_prompt(
            customer_message, order_info, policies, workflow_state
        )

        log.info("[Groq] Calling model=%s …", GROQ_MODEL)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=256,
        )

        content = response.choices[0].message.content or ""
        log.debug("[Groq] Raw response: %s", content[:300])
        parsed = _parse_response(content)

        return {
            **parsed,
            "groq_used": True,
            "groq_model": GROQ_MODEL,
            "error": None,
        }

    except Exception as exc:
        log.error("[Groq] API call failed: %s", exc)
        return {
            "interpretation": f"Groq call failed: {exc}",
            "recommended_action": "escalate_to_human",
            "confidence": 0.0,
            "needs_human": True,
            "groq_used": True,
            "groq_model": GROQ_MODEL,
            "error": str(exc),
        }


def route_classify(customer_message: str) -> dict:
    """
    Use Groq specifically to classify the route when OpenJEV confidence is too low.

    Returns:
        {
            "route":      "returns" | "delivery" | "payment" | "unknown",
            "confidence": float,
            "groq_used":  True,
        }
    """
    if not GROQ_API_KEY:
        return {"route": "returns", "confidence": 0.33, "groq_used": True,
                "error": "GROQ_API_KEY not set – defaulting to returns"}

    system = (
        "You are a routing classifier. "
        "Given a customer message, output ONLY a JSON object: "
        '{"route": "<returns|delivery|payment>", "confidence": <0.0-1.0>}. '
        "returns: product return, refund, damaged item, incorrect item, missing item. "
        "delivery: late delivery, lost package, tracking issue, not arrived. "
        "payment: billing issue, duplicate charge, payment failure."
    )

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": customer_message},
            ],
            temperature=0.0,
            max_tokens=64,
        )
        content = response.choices[0].message.content or ""
        data = json.loads(content.strip())
        route = data.get("route", "returns")
        if route not in ("returns", "delivery", "payment"):
            route = "returns"
        return {
            "route": route,
            "confidence": float(data.get("confidence", 0.7)),
            "groq_used": True,
            "error": None,
        }
    except Exception as exc:
        log.error("[Groq route_classify] failed: %s", exc)
        return {
            "route": "returns",
            "confidence": 0.33,
            "groq_used": True,
            "error": str(exc),
        }
