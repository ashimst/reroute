"""
Payment tools – deterministic payment status and issue detection.

Rules applied:
    PAY-03  Captured == order_total → success
    PAY-04  Failed payment → inform, no refund
    PAY-05  Pending > 3 business days → cancel
    PAY-06  Duplicate charges → refund excess
    PAY-07  Amount discrepancy
    PAY-12  Escalation conditions
"""

from __future__ import annotations

import logging
from typing import Optional

import needle

from src.config import ESCALATION_REFUND_THRESHOLD
from src.data.repository import (
    get_order as _get_order,
    get_payment as _get_payment,
)

log = logging.getLogger(__name__)


@needle.tool
def check_payment_status(order_id: str) -> dict:
    """
    Return payment status summary for an order.

    Input:  order_id (str)
    Output: {
        order_id, payment_count, total_paid, payment_types,
        installments, status_summary
    }
    """
    payments = _get_payment(order_id)
    if not payments:
        return {
            "error": f"No payment records found for order '{order_id}'.",
            "order_id": order_id,
            "total_paid": 0.0,
        }

    total_paid = round(sum(float(p.get("payment_value", 0) or 0) for p in payments), 2)
    payment_types = list({p.get("payment_type", "unknown") for p in payments})
    max_installments = max(
        int(p.get("payment_installments", 1) or 1) for p in payments
    )

    return {
        "order_id": order_id,
        "payment_count": len(payments),
        "total_paid": total_paid,
        "payment_types": payment_types,
        "installments": max_installments,
        "payments_detail": payments,
        "status_summary": f"{len(payments)} payment record(s), total ${total_paid:.2f}",
    }


@needle.tool
def check_payment_amount(order_id: str) -> dict:
    """
    Compare total captured against a calculated expected amount from order items.

    Since Olist payments don't directly store order_total as a separate column,
    we sum payment_value as the captured amount and item prices + freight as the
    order total.

    Input:  order_id (str)
    Output: {
        order_id, captured_amount, expected_amount,
        discrepancy, discrepancy_type (str), applicable_rule (str)
    }
    """
    from src.data.repository import get_order_items as _get_order_items

    payments = _get_payment(order_id)
    items = _get_order_items(order_id)

    if not payments:
        return {
            "error": f"No payment records for order '{order_id}'.",
            "order_id": order_id,
        }
    if not items:
        return {
            "error": f"No order items for order '{order_id}'.",
            "order_id": order_id,
        }

    captured = round(sum(float(p.get("payment_value", 0) or 0) for p in payments), 2)
    expected = round(
        sum(float(i.get("price", 0) or 0) + float(i.get("freight_value", 0) or 0)
            for i in items),
        2,
    )
    discrepancy = round(captured - expected, 2)

    if abs(discrepancy) < 0.01:
        discrepancy_type = "none"
        rule = "PAY-03"
    elif discrepancy > 0:
        discrepancy_type = "overcharged"
        rule = "PAY-07"
    else:
        discrepancy_type = "undercharged"
        rule = "PAY-07"

    return {
        "order_id": order_id,
        "captured_amount": captured,
        "expected_amount": expected,
        "discrepancy": discrepancy,
        "discrepancy_type": discrepancy_type,
        "applicable_rule": rule,
        "note": (
            "Payment matches order total."
            if discrepancy_type == "none"
            else f"Discrepancy of ${abs(discrepancy):.2f} detected ({discrepancy_type})."
        ),
    }


@needle.tool
def detect_payment_issue(order_id: str) -> dict:
    """
    Detect the type of payment issue for an order and recommend an action.

    Uses order status + payment data to classify the issue.

    Input:  order_id (str)
    Output: {
        order_id, issue_type (str), recommended_action (str),
        escalate (bool), applicable_rule (str), note (str)
    }
    """
    order = _get_order(order_id)
    if order is None:
        return {
            "error": f"Order '{order_id}' not found.",
            "order_id": order_id,
            "escalate": True,
        }

    payments = _get_payment(order_id)
    if not payments:
        return {
            "order_id": order_id,
            "issue_type": "no_payment_record",
            "recommended_action": "investigate_manually",
            "escalate": True,
            "applicable_rule": "PAY-12",
            "note": "No payment records found. Manual investigation required.",
        }

    order_status = (order.get("order_status") or "").lower()
    total_paid = round(sum(float(p.get("payment_value", 0) or 0) for p in payments), 2)
    payment_count = len(payments)

    # Duplicate payment detection: more than one payment record for same order
    # and the total paid exceeds a reasonable single-order amount  (PAY-06)
    if payment_count > 1:
        first_value = float(payments[0].get("payment_value", 0) or 0)
        # Heuristic: if multiple records with similar values → possible duplicate
        similar_values = [
            p for p in payments
            if abs(float(p.get("payment_value", 0) or 0) - first_value) < 0.50
        ]
        if len(similar_values) == payment_count and payment_count > 1:
            excess = round(total_paid - first_value, 2)
            escalate = excess > ESCALATION_REFUND_THRESHOLD
            return {
                "order_id": order_id,
                "issue_type": "duplicate_payment",
                "duplicate_charge": excess,
                "recommended_action": (
                    "escalate_to_human" if escalate
                    else f"refund_duplicate_charge_${excess:.2f}"
                ),
                "escalate": escalate,
                "applicable_rule": "PAY-06",
                "note": (
                    f"{payment_count} payment records with similar amounts detected. "
                    f"Possible duplicate charge of ${excess:.2f}."
                ),
            }

    # Failed payment
    if order_status in ("payment failed", "unavailable") or total_paid == 0:
        return {
            "order_id": order_id,
            "issue_type": "failed_payment",
            "recommended_action": "inform_customer_retry",
            "escalate": False,
            "applicable_rule": "PAY-04",
            "note": "Payment appears to have failed. Inform customer and provide retry link.",
        }

    # Pending
    if order_status == "processing" and total_paid > 0:
        return {
            "order_id": order_id,
            "issue_type": "payment_captured",
            "recommended_action": "no_action",
            "escalate": False,
            "applicable_rule": "PAY-03",
            "note": f"Payment of ${total_paid:.2f} captured. Order is processing.",
        }

    # Default: payment looks normal
    return {
        "order_id": order_id,
        "issue_type": "no_issue_detected",
        "total_paid": total_paid,
        "recommended_action": "no_action",
        "escalate": False,
        "applicable_rule": "PAY-03",
        "note": f"Payment of ${total_paid:.2f} captured. No issues detected.",
    }
