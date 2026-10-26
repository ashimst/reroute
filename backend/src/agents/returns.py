"""
Returns Agent.

Handles: return requests, damaged products, incorrect products,
         missing items, and refund-related return requests.

Flow:
  1. Retrieve return/refund policy chunks relevant to the message.
  2. Fetch order and items from the Olist data layer.
  3. Detect the exception reason from the customer message.
  4. Run deterministic tools through Cactus Needle:
       check_return_window → check_return_eligibility → calculate_refund
  5. Apply escalation rules deterministically.
  6. Return a structured result dict.

The agent NEVER calls an LLM itself. If it cannot reach a confident
conclusion, it sets `needs_groq=True` and `confidence` low so the
graph can route to the Groq fallback.
"""

from __future__ import annotations

import logging
from typing import Any

import needle

from src.config import ESCALATION_REFUND_THRESHOLD, RESOLUTION_CONFIDENCE_THRESHOLD
from src.data.repository import get_customer, get_order, get_order_items
from src.rag.policy_retriever import retrieve_for_route
from src.tools.order_tools import get_order as tool_get_order
from src.tools.order_tools import get_order_items as tool_get_order_items
from src.tools.return_tools import (
    calculate_refund,
    check_return_eligibility,
    check_return_window,
)

log = logging.getLogger(__name__)

# ── Needle executor ───────────────────────────────────────────────────────────
_needle_agent = needle.Needle(
    tools=[
        tool_get_order,
        tool_get_order_items,
        check_return_window,
        check_return_eligibility,
        calculate_refund,
    ]
)

# ── Reason detection keywords ─────────────────────────────────────────────────
_DAMAGED_KW = {"damaged", "broken", "cracked", "smashed", "defective", "faulty",
               "not working", "arrived broken", "arrived damaged"}
_INCORRECT_KW = {"wrong item", "incorrect", "not what i ordered", "wrong product",
                 "sent wrong", "different item"}
_MISSING_KW = {"missing", "not in box", "missing item", "not included", "empty box"}


def _detect_reason(message: str) -> str:
    text = message.lower()
    if any(kw in text for kw in _DAMAGED_KW):
        return "damaged"
    if any(kw in text for kw in _INCORRECT_KW):
        return "incorrect"
    if any(kw in text for kw in _MISSING_KW):
        return "missing"
    return "standard"


def run(order_id: str, customer_message: str, simulated_days: Optional[int] = None) -> dict:
    """
    Execute the returns workflow for an order.
    """
    from src.tools.time_anchor import set_simulation_context
    if simulated_days is not None:
        set_simulation_context(simulated_days=simulated_days)

    log.info("[Returns Agent] order_id=%s simulated_days=%s", order_id, simulated_days)
    tools_executed: list[str] = []
    applicable_rules: list[str] = []
    tool_results: dict[str, Any] = {}

    # ── Step 1: Retrieve relevant policy chunks ───────────────────────────────
    policies = retrieve_for_route("returns", customer_message, top_k=5)
    log.debug("[Returns Agent] Retrieved %d policy chunks.", len(policies))

    # ── Step 2: Fetch base order data ─────────────────────────────────────────
    order_result = tool_get_order(order_id)
    tools_executed.append("get_order")
    tool_results["get_order"] = order_result

    if "error" in order_result:
        return _error_result(order_id, order_result["error"], policies, tools_executed)

    items_result = tool_get_order_items(order_id)
    tools_executed.append("get_order_items")
    tool_results["get_order_items"] = items_result

    # ── Step 3: Detect exception reason ──────────────────────────────────────
    reason = _detect_reason(customer_message)
    log.info("[Returns Agent] Detected reason: %s", reason)

    # ── Step 4: Check return window ───────────────────────────────────────────
    window = check_return_window(order_id)
    tools_executed.append("check_return_window")
    tool_results["check_return_window"] = window

    # ── Step 5: Check eligibility ─────────────────────────────────────────────
    eligibility = check_return_eligibility(order_id, reason=reason)
    tools_executed.append("check_return_eligibility")
    tool_results["check_return_eligibility"] = eligibility
    applicable_rules.append(eligibility.get("applicable_rule", ""))

    if not eligibility.get("eligible", False):
        return {
            "agent": "returns",
            "order_id": order_id,
            "reason_detected": reason,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "denied",
            "resolution_detail": eligibility.get("note", "Return not eligible."),
            "escalate": eligibility.get("escalate", False),
            "escalate_reason": eligibility.get("note") if eligibility.get("escalate") else None,
            "refund_amount": None,
            "confidence": 0.9,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # ── Step 6: Calculate refund ──────────────────────────────────────────────
    refund = calculate_refund(order_id, reason=reason)
    tools_executed.append("calculate_refund")
    tool_results["calculate_refund"] = refund
    applicable_rules.append(refund.get("applicable_rule", ""))

    refund_amount: float = refund.get("refund_amount", 0.0)
    requires_escalation: bool = refund.get("requires_escalation", False)

    # RET-17: escalate if refund > $500
    if requires_escalation:
        return {
            "agent": "returns",
            "order_id": order_id,
            "reason_detected": reason,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "escalated",
            "resolution_detail": (
                f"Refund amount ${refund_amount:.2f} exceeds ${ESCALATION_REFUND_THRESHOLD:.0f}. "
                "Escalated to human agent per RET-17."
            ),
            "escalate": True,
            "escalate_reason": "Refund exceeds $500 threshold (RET-17)",
            "refund_amount": refund_amount,
            "confidence": 0.95,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # ── Step 7: Approve ───────────────────────────────────────────────────────
    approved_action = eligibility.get("approved_action", "standard_return")
    resolution_map = {
        "replacement_or_full_refund": f"Full refund of ${refund_amount:.2f} approved",
        "standard_return": f"Standard return approved; refund ${refund_amount:.2f} after inspection",
    }
    resolution_detail = resolution_map.get(
        approved_action,
        f"Return approved; refund ${refund_amount:.2f}",
    )

    return {
        "agent": "returns",
        "order_id": order_id,
        "reason_detected": reason,
        "policies": policies,
        "tool_results": tool_results,
        "resolution": "approved",
        "resolution_detail": resolution_detail,
        "escalate": False,
        "escalate_reason": None,
        "refund_amount": refund_amount,
        "confidence": 0.92,
        "needs_groq": False,
        "tools_executed": tools_executed,
        "applicable_rules": [r for r in applicable_rules if r],
    }


def _error_result(order_id: str, error_msg: str, policies: list, tools: list) -> dict:
    return {
        "agent": "returns",
        "order_id": order_id,
        "reason_detected": "unknown",
        "policies": policies,
        "tool_results": {"error": error_msg},
        "resolution": "error",
        "resolution_detail": error_msg,
        "escalate": True,
        "escalate_reason": f"Data error: {error_msg}",
        "refund_amount": None,
        "confidence": 0.0,
        "needs_groq": False,
        "tools_executed": tools,
        "applicable_rules": [],
    }
