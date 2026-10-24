"""
Payment Agent.

Handles: payment failure, payment discrepancy, duplicate payment claims,
         payment status questions.

Flow:
  1. Retrieve payment policy chunks.
  2. Fetch order and payment data.
  3. Run deterministic tools: check_payment_status → check_payment_amount
     → detect_payment_issue.
  4. Apply PAY-* rules to produce a resolution or escalation.
"""

from __future__ import annotations

import logging
from typing import Any

import needle

from src.config import ESCALATION_REFUND_THRESHOLD
from src.rag.policy_retriever import retrieve_for_route
from src.tools.order_tools import get_order as tool_get_order
from src.tools.payment_tools import (
    check_payment_amount,
    check_payment_status,
    detect_payment_issue,
)

log = logging.getLogger(__name__)

_needle_agent = needle.Needle(
    tools=[
        tool_get_order,
        check_payment_status,
        check_payment_amount,
        detect_payment_issue,
    ]
)


def run(order_id: str, customer_message: str) -> dict:
    """
    Execute the payment workflow for an order.

    Returns:
        {
            "agent":           "payment",
            "order_id":        str,
            "policies":        list[dict],
            "tool_results":    dict,
            "resolution":      str,
            "resolution_detail": str,
            "escalate":        bool,
            "escalate_reason": str | None,
            "confidence":      float,
            "needs_groq":      bool,
            "tools_executed":  list[str],
            "applicable_rules": list[str],
        }
    """
    log.info("[Payment Agent] order_id=%s", order_id)
    tools_executed: list[str] = []
    applicable_rules: list[str] = []
    tool_results: dict[str, Any] = {}

    # ── Step 1: Policy retrieval ──────────────────────────────────────────────
    policies = retrieve_for_route("payment", customer_message, top_k=5)

    # ── Step 2: Fetch order ───────────────────────────────────────────────────
    order_result = tool_get_order(order_id)
    tools_executed.append("get_order")
    tool_results["get_order"] = order_result

    if "error" in order_result:
        return _error_result(order_id, order_result["error"], policies, tools_executed)

    # ── Step 3: Payment status ────────────────────────────────────────────────
    status_result = check_payment_status(order_id)
    tools_executed.append("check_payment_status")
    tool_results["check_payment_status"] = status_result

    if "error" in status_result:
        return _error_result(order_id, status_result["error"], policies, tools_executed)

    total_paid: float = status_result.get("total_paid", 0.0)

    # ── Step 4: Amount check ──────────────────────────────────────────────────
    amount_result = check_payment_amount(order_id)
    tools_executed.append("check_payment_amount")
    tool_results["check_payment_amount"] = amount_result

    discrepancy_type = amount_result.get("discrepancy_type", "none")
    discrepancy = amount_result.get("discrepancy", 0.0)
    applicable_rules.append(amount_result.get("applicable_rule", "PAY-03"))

    # ── Step 5: Issue detection ───────────────────────────────────────────────
    issue_result = detect_payment_issue(order_id)
    tools_executed.append("detect_payment_issue")
    tool_results["detect_payment_issue"] = issue_result

    issue_type = issue_result.get("issue_type", "no_issue_detected")
    escalate = issue_result.get("escalate", False)
    issue_rule = issue_result.get("applicable_rule", "PAY-03")
    applicable_rules.append(issue_rule)

    # ── Step 6: Apply policy and resolve ─────────────────────────────────────

    # Duplicate payment
    if issue_type == "duplicate_payment":
        excess = issue_result.get("duplicate_charge", 0.0)
        if escalate:
            return {
                "agent": "payment",
                "order_id": order_id,
                "policies": policies,
                "tool_results": tool_results,
                "resolution": "escalated",
                "resolution_detail": (
                    f"Duplicate charge of ${excess:.2f} detected. "
                    f"Exceeds ${ESCALATION_REFUND_THRESHOLD:.0f} threshold. "
                    "Escalated to human agent (PAY-12c)."
                ),
                "escalate": True,
                "escalate_reason": f"Duplicate refund > ${ESCALATION_REFUND_THRESHOLD:.0f} (PAY-12c)",
                "confidence": 0.92,
                "needs_groq": False,
                "tools_executed": tools_executed,
                "applicable_rules": [r for r in applicable_rules if r],
            }
        return {
            "agent": "payment",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "refund_duplicate",
            "resolution_detail": (
                f"Duplicate payment confirmed. Refund of ${excess:.2f} approved (PAY-06)."
            ),
            "escalate": False,
            "escalate_reason": None,
            "confidence": 0.90,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # Amount discrepancy – overcharged
    if discrepancy_type == "overcharged" and discrepancy > 0.01:
        excess = abs(discrepancy)
        if excess > ESCALATION_REFUND_THRESHOLD:
            return {
                "agent": "payment",
                "order_id": order_id,
                "policies": policies,
                "tool_results": tool_results,
                "resolution": "escalated",
                "resolution_detail": (
                    f"Overcharge of ${excess:.2f} detected. "
                    "Escalated to human agent (PAY-12g)."
                ),
                "escalate": True,
                "escalate_reason": f"Payment discrepancy > ${ESCALATION_REFUND_THRESHOLD:.0f} (PAY-12g)",
                "confidence": 0.90,
                "needs_groq": False,
                "tools_executed": tools_executed,
                "applicable_rules": [r for r in applicable_rules if r],
            }
        return {
            "agent": "payment",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "refund_overcharge",
            "resolution_detail": (
                f"Payment overcharge of ${excess:.2f} confirmed. "
                "Refund of difference approved (PAY-07)."
            ),
            "escalate": False,
            "escalate_reason": None,
            "confidence": 0.88,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # Failed payment
    if issue_type == "failed_payment":
        return {
            "agent": "payment",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "inform_retry",
            "resolution_detail": (
                "Payment has failed. Customer informed; retry link provided. "
                "No refund issued (PAY-04)."
            ),
            "escalate": False,
            "escalate_reason": None,
            "confidence": 0.92,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # Escalation required by issue detection tool
    if escalate:
        return {
            "agent": "payment",
            "order_id": order_id,
            "policies": policies,
            "tool_results": tool_results,
            "resolution": "escalated",
            "resolution_detail": issue_result.get("note", "Escalation required."),
            "escalate": True,
            "escalate_reason": issue_result.get("note"),
            "confidence": 0.85,
            "needs_groq": False,
            "tools_executed": tools_executed,
            "applicable_rules": [r for r in applicable_rules if r],
        }

    # No issue detected
    return {
        "agent": "payment",
        "order_id": order_id,
        "policies": policies,
        "tool_results": tool_results,
        "resolution": "no_action",
        "resolution_detail": (
            f"Payment of ${total_paid:.2f} confirmed. No issues found (PAY-03)."
        ),
        "escalate": False,
        "escalate_reason": None,
        "confidence": 0.95,
        "needs_groq": False,
        "tools_executed": tools_executed,
        "applicable_rules": [r for r in applicable_rules if r],
    }


def _error_result(order_id: str, error_msg: str, policies: list, tools: list) -> dict:
    return {
        "agent": "payment",
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
