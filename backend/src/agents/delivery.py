"""
Delivery Agent.

Handles: late deliveries, orders still processing, orders in transit,
         delivered-but-missing complaints, stuck parcels.

Flow:
  1. Retrieve delivery policy chunks.
  2. Fetch delivery status from the data layer.
  3. Run deterministic tools: check_delivery_status → check_delivery_delay.
  4. Apply DEL-* rules to produce a resolution or escalation.
  5. Return structured result; set needs_groq=True only if state is ambiguous.
"""

from __future__ import annotations

import logging
from typing import Any

import needle

from src.config import MISSING_DELIVERY_REPORT_DAYS, TRANSIT_REFUND_DAYS, TRANSIT_STUCK_DAYS
from src.rag.policy_retriever import retrieve_for_route
from src.tools.delivery_tools import check_delivery_delay, check_delivery_status
from src.tools.order_tools import get_order as tool_get_order

log = logging.getLogger(__name__)

_needle_agent = needle.Needle(
    tools=[
        tool_get_order,
        check_delivery_status,
        check_delivery_delay,
    ]
)

_MISSING_KW = {
    "not received", "haven't received", "didn't receive", "says delivered",
    "marked delivered", "delivery says delivered", "not here", "can't find",
}


def _maybe_missing(message: str) -> bool:
    text = message.lower()
    return any(kw in text for kw in _MISSING_KW)


def run(order_id: str, customer_message: str, simulated_days: Optional[int] = None) -> dict:
    """
    Execute the delivery workflow for an order.
    """
    from src.tools.time_anchor import set_simulation_context
    if simulated_days is not None:
        set_simulation_context(simulated_days=simulated_days)

    log.info("[Delivery Agent] order_id=%s simulated_days=%s", order_id, simulated_days)
    tools_executed: list[str] = []
    applicable_rules: list[str] = []
    tool_results: dict[str, Any] = {}

    # ── Step 1: Policy retrieval ──────────────────────────────────────────────
    policies = retrieve_for_route("delivery", customer_message, top_k=5)

    # ── Step 2: Fetch order ───────────────────────────────────────────────────
    order_result = tool_get_order(order_id)
    tools_executed.append("get_order")
    tool_results["get_order"] = order_result

    if "error" in order_result:
        return _error_result(order_id, order_result["error"], policies, tools_executed)

    # ── Step 3: Delivery status ───────────────────────────────────────────────
    status_result = check_delivery_status(order_id)
    tools_executed.append("check_delivery_status")
    tool_results["check_delivery_status"] = status_result

    if "error" in status_result:
        return _error_result(order_id, status_result["error"], policies, tools_executed)

    order_status = (status_result.get("order_status") or "").lower()
    is_delivered = status_result.get("is_delivered", False)
    is_late = status_result.get("is_late", False)
    days_since_purchase = status_result.get("days_since_purchase")

    # ── Step 4: Delay analysis ────────────────────────────────────────────────
    delay_result = check_delivery_delay(order_id)
    tools_executed.append("check_delivery_delay")
    tool_results["check_delivery_delay"] = delay_result
    rule = delay_result.get("applicable_rule", "DEL-06")
    applicable_rules.append(rule)

    action = delay_result.get("action", "no_action")
    compensation = delay_result.get("compensation")
    escalate = delay_result.get("escalate", False)

    # ── Step 5: "Marked delivered but missing" branch ─────────────────────────
    if is_delivered and _maybe_missing(customer_message):
        applicable_rules.append("DEL-12")
        return {
            "agent": "delivery",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "investigation_required",
            "resolution_detail": (
                "Order is marked as delivered but customer reports non-receipt. "
                "Carrier GPS check required. If no GPS confirmation, "
                "replacement or refund will be processed (DEL-12)."
            ),
            "escalate": False,
            "escalate_reason": None,
            "confidence": 0.75,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # ── Step 6: Stuck in transit ──────────────────────────────────────────────
    if order_status in ("in transit", "delivery exception"):
        days_since = days_since_purchase or 0
        if days_since >= TRANSIT_REFUND_DAYS:
            applicable_rules.append("DEL-11")
            return {
                "agent": "delivery",
                "order_id": order_id,
                "policies": policies,
                "tool_results": tool_results,
                "resolution": "refund_or_replacement",
                "resolution_detail": (
                    f"Order stuck in transit for {days_since} days "
                    f"(>{TRANSIT_REFUND_DAYS} days threshold). "
                    "Full refund or replacement authorised (DEL-11)."
                ),
                "escalate": False,
                "escalate_reason": None,
                "confidence": 0.88,
                "needs_groq": False,
                "tools_executed": tools_executed,
                "applicable_rules": [r for r in applicable_rules if r],
            }
        elif days_since >= TRANSIT_STUCK_DAYS:
            applicable_rules.append("DEL-11")
            return {
                "agent": "delivery",
                "order_id": order_id,
                "policies": policies,
                "tool_results": tool_results,
                "resolution": "carrier_trace",
                "resolution_detail": (
                    f"Order in transit for {days_since} days with no recent scan. "
                    "Carrier trace opened (DEL-11)."
                ),
                "escalate": False,
                "escalate_reason": None,
                "confidence": 0.85,
                "needs_groq": False,
                "tools_executed": tools_executed,
                "applicable_rules": [r for r in applicable_rules if r],
            }

    # ── Step 7: Normal delay resolution ──────────────────────────────────────
    if not is_late:
        detail = (
            status_result.get("status_label") or
            f"Order status: {order_status}. No delay detected."
        )
        return {
            "agent": "delivery",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "no_action",
            "resolution_detail": detail,
            "escalate": False,
            "escalate_reason": None,
            "confidence": 0.95,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": ["DEL-06"],
        }

    detail_parts = [delay_result.get("note", "Delay detected.")]
    if compensation:
        detail_parts.append(f"Compensation: {compensation}.")

    return {
        "agent": "delivery",
        "order_id": order_id,
        "policies": policies,
        "tool_results": tool_results,
        "resolution": action,
        "resolution_detail": " ".join(detail_parts),
        "escalate": escalate,
        "escalate_reason": delay_result.get("note") if escalate else None,
        "confidence": 0.90,
        "needs_groq": False,
        "tools_executed": tools_executed,
        "applicable_rules": [r for r in applicable_rules if r],
    }


def _error_result(order_id: str, error_msg: str, policies: list, tools: list) -> dict:
    return {
        "agent": "delivery",
        "order_id": order_id,
        "policies": policies,
        "tool_results": {"error": error_msg},
        "resolution": "error",
        "resolution_detail": error_msg,
        "escalate": True,
        "escalate_reason": f"Data error: {error_msg}",
        "confidence": 0.0,
        "needs_groq": False,
        "tools_executed": tools,
        "applicable_rules": [],
    }
