"""
Open-JEV routing layer.

Uses the TypeSafe SDK (compatible with the razorback16/openjev server and the
official TypeSafe Jev API) to make fast typed routing decisions.

Decision primitives:
  choice  → pick one of: returns / delivery / payment
  score   → urgency 0-2
  noul    → needs_human probability

Configuration:
  OPENJEV_BASE_URL  – base URL of your openjev server (default: https://api.codiv.ai)
  OPENJEV_API_KEY   – API key for the hosted service
  OPENJEV_MODEL     – model name (default: openjev-latest)

If the SDK is not installed or the API is unreachable, the router falls back to
a deterministic keyword classifier. This means the system works out of the box
without any API key.

If routing confidence is below ROUTING_CONFIDENCE_THRESHOLD the router sets
`use_groq_fallback=True` so the graph can ask Groq to reclassify.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from src.config import ROUTING_CONFIDENCE_THRESHOLD

log = logging.getLogger(__name__)

# ── Keyword fallback (always available, no deps) ──────────────────────────────

_RETURN_KEYWORDS = {
    "return", "refund", "damaged", "broken", "cracked", "defective", "faulty",
    "wrong item", "incorrect", "not as described", "missing item", "exchange",
    "money back", "arrived broken", "arrived damaged", "smashed",
}
_DELIVERY_KEYWORDS = {
    "late", "delayed", "not arrived", "where is my order", "tracking",
    "still waiting", "hasn't arrived", "not received", "haven't received",
    "missing", "lost", "not delivered", "delivered but", "package",
    "shipping", "in transit", "says delivered",
}
_PAYMENT_KEYWORDS = {
    "charged", "charge", "payment", "duplicate", "double charged",
    "billed", "invoice", "overcharged", "billing", "credit card",
    "transaction", "paid twice", "refund payment",
}


def _keyword_route(message: str) -> tuple[str, float]:
    """
    Keyword-based route classifier.
    Returns (route, confidence). Confidence is deliberately capped at 0.75
    so that a real JEV backend (if present) with higher confidence takes priority.
    """
    text = message.lower()

    scores = {
        "returns":  sum(1 for kw in _RETURN_KEYWORDS  if kw in text),
        "delivery": sum(1 for kw in _DELIVERY_KEYWORDS if kw in text),
        "payment":  sum(1 for kw in _PAYMENT_KEYWORDS  if kw in text),
    }

    best_route = max(scores, key=scores.__getitem__)
    best_score = scores[best_route]
    total = sum(scores.values())

    if total == 0:
        return "returns", 0.33   # no signal – lowest-confidence default

    confidence = min(best_score / total, 0.75)
    return best_route, confidence


# ── TypeSafe SDK client (optional) ────────────────────────────────────────────
_client = None
_sdk_available: bool | None = None


def _get_client():
    """Try to build a TypeSafe/OpenJEV client. Returns None if unavailable."""
    global _client, _sdk_available

    if _sdk_available is False:
        return None
    if _client is not None:
        return _client

    base_url = os.getenv("OPENJEV_BASE_URL", "https://api.codiv.ai")
    api_key  = os.getenv("OPENJEV_API_KEY", "")

    if not api_key:
        log.info(
            "OPENJEV_API_KEY not set – using keyword-based routing. "
            "Set OPENJEV_API_KEY (and optionally OPENJEV_BASE_URL) to enable OpenJEV."
        )
        _sdk_available = False
        return None

    try:
        from typesafe_sdk import TypeSafeClient
        _client = TypeSafeClient(base_url=base_url, api_key=api_key)
        _sdk_available = True
        log.info("OpenJEV client initialised (base_url=%s).", base_url)
        return _client
    except ImportError:
        log.info(
            "typesafe_sdk not installed – using keyword routing. "
            "Install with: pip install typesafe-sdk"
        )
        _sdk_available = False
        return None
    except Exception as exc:
        log.warning("OpenJEV client init failed: %s. Using keyword routing.", exc)
        _sdk_available = False
        return None


# ── Main router ───────────────────────────────────────────────────────────────

def route(customer_message: str, order_context: Optional[str] = None) -> dict:
    """
    Route a customer message to the appropriate workflow.

    Returns:
        {
            "route":             "returns" | "delivery" | "payment",
            "confidence":        float 0..1,
            "urgency":           float 0..2,
            "needs_human_prob":  float 0..1,
            "use_groq_fallback": bool,
            "backend_used":      "openjev" | "keyword_fallback",
            "raw_answers":       dict | None,
        }
    """
    state_text = customer_message
    if order_context:
        state_text = f"{customer_message}\n\nOrder context: {order_context}"

    client = _get_client()
    if client is not None:
        try:
            return _route_via_sdk(client, state_text)
        except Exception as exc:
            log.warning("OpenJEV API call failed (%s). Falling back to keywords.", exc)

    # ── Keyword fallback ──────────────────────────────────────────────────────
    route_name, confidence = _keyword_route(customer_message)
    use_groq = confidence < ROUTING_CONFIDENCE_THRESHOLD

    log.info(
        "[jev_router] keyword route=%s confidence=%.2f groq_needed=%s",
        route_name, confidence, use_groq,
    )

    return {
        "route": route_name,
        "confidence": confidence,
        "urgency": 1.0,
        "needs_human_prob": 0.1,
        "use_groq_fallback": use_groq,
        "backend_used": "keyword_fallback",
        "raw_answers": None,
    }


def _route_via_sdk(client, state_text: str) -> dict:
    """Route using the TypeSafe SDK against a running OpenJEV server."""
    model = os.getenv("OPENJEV_MODEL", "openjev-latest")

    r = client.system_one(
        state_text,
        {
            "route": {
                "type": "choice",
                "instructions": (
                    "Which workflow should handle this customer message? "
                    "returns: product return, refund, damaged item, incorrect item, missing item. "
                    "delivery: late delivery, lost package, tracking issue, not arrived. "
                    "payment: billing issue, duplicate charge, payment failure."
                ),
                "criteria": {
                    "returns":  "Product return, refund, damaged, incorrect, or missing item.",
                    "delivery": "Late delivery, lost package, tracking, not arrived.",
                    "payment":  "Billing issue, duplicate charge, payment failure.",
                },
            },
            "urgency": {
                "type": "score",
                "instructions": "How urgent is this customer issue?",
                "criteria": [
                    "routine – no time pressure",
                    "moderate – customer waiting",
                    "high – financial impact or escalation likely",
                ],
            },
            "needs_human": {
                "type": "noul",
                "instructions": (
                    "The issue is complex, involves fraud, or the customer is "
                    "requesting to speak to a human agent."
                ),
            },
        },
        model=model,
    )

    # TypeSafe SDK response shape: r.choices["route"].choice, r.scores["urgency"].score,
    # r.nouls["needs_human"].noul
    route_answer  = r.choices.get("route")
    urgency_answer = r.scores.get("urgency")
    human_answer  = r.nouls.get("needs_human")

    route_name  = route_answer.choice   if route_answer  else "returns"
    confidence  = getattr(route_answer, "confidence", 0.7)
    urgency     = urgency_answer.score  if urgency_answer else 1.0
    needs_human = human_answer.noul     if human_answer  else 0.1

    if route_name not in ("returns", "delivery", "payment"):
        route_name = "returns"

    use_groq = confidence < ROUTING_CONFIDENCE_THRESHOLD

    log.info(
        "[jev_router] openjev route=%s confidence=%.2f urgency=%.1f needs_human=%.2f",
        route_name, confidence, urgency, needs_human,
    )

    return {
        "route": route_name,
        "confidence": confidence,
        "urgency": urgency,
        "needs_human_prob": needs_human,
        "use_groq_fallback": use_groq,
        "backend_used": "openjev",
        "raw_answers": {
            "route_probabilities": getattr(route_answer, "probabilities", None),
        },
    }
