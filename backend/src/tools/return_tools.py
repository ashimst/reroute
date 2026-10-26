"""
Return tools – deterministic eligibility and refund calculations.

Rules applied:
    RET-02  30-day standard return window from delivery date
    RET-09  Damaged items: 7-day report window
    RET-11  Incorrect items: 14-day report window
    RET-17  Escalate if refund > $500
    REF-05  Refund = sum(item prices) + freight (for non-standard reasons)
    REF-06  20% deduction for missing accessories (standard returns)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import needle

from src.config import (
    DAMAGED_REPORT_DAYS,
    ESCALATION_REFUND_THRESHOLD,
    INCORRECT_REPORT_DAYS,
    MISSING_REPORT_DAYS,
    RETURN_WINDOW_DAYS,
)
from src.data.repository import (
    get_delivery_status as _get_delivery_status,
    get_order as _get_order,
    get_order_items as _get_order_items,
    get_payment as _get_payment,
)

from src.tools.time_anchor import get_order_evaluation_context

log = logging.getLogger(__name__)


def _parse(iso: Optional[str]) -> Optional[datetime]:
    if iso is None:
        return None
    try:
        clean = iso.strip().replace("T", " ")[:19]
        return datetime.fromisoformat(clean)
    except (ValueError, TypeError):
        return None


@needle.tool
def check_return_window(order_id: str) -> dict:
    """
    Check whether the standard 30-day return window is still open (RET-02).
    Evaluated relative to the historical order delivery milestone.

    Input:  order_id (str)
    Output: {
        order_id, delivery_date, evaluation_reference_date, days_since_delivery,
        window_days, within_window (bool), time_anchored (bool), error (str|None)
    }
    """
    delivery = _get_delivery_status(order_id)
    if delivery is None:
        return {"error": f"Order '{order_id}' not found.", "order_id": order_id}

    delivery_date_str = delivery.get("delivery_date")
    if not delivery_date_str:
        return {
            "order_id": order_id,
            "delivery_date": None,
            "days_since_delivery": None,
            "window_days": RETURN_WINDOW_DAYS,
            "within_window": False,
            "note": "Order has not been delivered yet – return window has not started.",
        }

    eval_dt, days, _ = get_order_evaluation_context(order_id)
    within = days is not None and days <= RETURN_WINDOW_DAYS

    return {
        "order_id": order_id,
        "delivery_date": delivery_date_str,
        "evaluation_reference_date": eval_dt.date().isoformat(),
        "days_since_delivery": days,
        "window_days": RETURN_WINDOW_DAYS,
        "within_window": within,
        "time_anchored": True,
    }


@needle.tool
def check_return_eligibility(
    order_id: str,
    reason: str = "standard",
) -> dict:
    """
    Determine whether an order is eligible for return and what the outcome should be.

    reason: one of "standard" | "damaged" | "incorrect" | "missing"

    Input:  order_id (str), reason (str)
    Output: {
        order_id, reason, eligible (bool),
        approved_action (str), applicable_rule (str),
        escalate (bool), note (str)
    }
    """
    reason = reason.lower().strip()
    delivery = _get_delivery_status(order_id)
    if delivery is None:
        return {
            "error": f"Order '{order_id}' not found.",
            "order_id": order_id,
            "eligible": False,
            "escalate": True,
        }

    delivery_date_str = delivery.get("delivery_date")
    eval_dt, days_since_delivery, _ = get_order_evaluation_context(order_id)

    # Order not yet delivered
    if delivery_date_str is None:
        return {
            "order_id": order_id,
            "reason": reason,
            "eligible": False,
            "approved_action": "none",
            "applicable_rule": "RET-03",
            "escalate": False,
            "days_since_delivery": days_since_delivery,
            "evaluation_reference_date": eval_dt.date().isoformat(),
            "time_anchored": True,
            "note": "Order has not been delivered; return window has not started.",
        }

    # --- Damaged on arrival (RET-09 / RET-10) ---
    if reason == "damaged":
        if days_since_delivery is not None and days_since_delivery <= DAMAGED_REPORT_DAYS:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": True,
                "approved_action": "replacement_or_full_refund",
                "applicable_rule": "RET-09",
                "escalate": False,
                "note": f"Damaged item reported within {DAMAGED_REPORT_DAYS} days. Eligible.",
            }
        else:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": False,
                "approved_action": "denied",
                "applicable_rule": "RET-10",
                "escalate": False,
                "note": (
                    f"Damaged item reported after {DAMAGED_REPORT_DAYS} days "
                    f"({days_since_delivery} days since delivery). "
                    "Denied unless exception applies (RET-20)."
                ),
            }

    # --- Incorrect item received (RET-11) ---
    if reason == "incorrect":
        if days_since_delivery is not None and days_since_delivery <= INCORRECT_REPORT_DAYS:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": True,
                "approved_action": "replacement_or_full_refund",
                "applicable_rule": "RET-11",
                "escalate": False,
                "note": f"Incorrect item reported within {INCORRECT_REPORT_DAYS} days. Eligible.",
            }
        else:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": False,
                "approved_action": "denied",
                "applicable_rule": "RET-13",
                "escalate": False,
                "note": (
                    f"Incorrect item reported after {INCORRECT_REPORT_DAYS} days "
                    f"({days_since_delivery} days since delivery). Denied."
                ),
            }

    # --- Missing item (RET-12) ---
    if reason == "missing":
        if days_since_delivery is not None and days_since_delivery <= MISSING_REPORT_DAYS:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": True,
                "approved_action": "replacement_or_full_refund",
                "applicable_rule": "RET-12",
                "escalate": False,
                "note": f"Missing item reported within {MISSING_REPORT_DAYS} days. Eligible pending carrier weight confirmation.",
            }
        else:
            return {
                "order_id": order_id,
                "reason": reason,
                "eligible": False,
                "approved_action": "denied",
                "applicable_rule": "RET-13",
                "escalate": False,
                "note": (
                    f"Missing item reported after {MISSING_REPORT_DAYS} days "
                    f"({days_since_delivery} days since delivery). Denied."
                ),
            }

    # --- Standard return (RET-03) ---
    if days_since_delivery is not None and days_since_delivery <= RETURN_WINDOW_DAYS:
        return {
            "order_id": order_id,
            "reason": reason,
            "eligible": True,
            "approved_action": "standard_return",
            "applicable_rule": "RET-03",
            "escalate": False,
            "note": f"Within {RETURN_WINDOW_DAYS}-day return window ({days_since_delivery} days since delivery).",
        }
    else:
        return {
            "order_id": order_id,
            "reason": reason,
            "eligible": False,
            "approved_action": "denied",
            "applicable_rule": "RET-02",
            "escalate": False,
            "note": (
                f"Return window expired. {days_since_delivery} days since delivery, "
                f"window is {RETURN_WINDOW_DAYS} days."
            ),
        }


@needle.tool
def calculate_refund(
    order_id: str,
    reason: str = "standard",
    missing_accessories: bool = False,
) -> dict:
    """
    Calculate the refund amount for an order (REF-05).

    reason: "standard" | "damaged" | "incorrect" | "missing"
    missing_accessories: apply 20% deduction for standard returns (REF-06)

    Input:  order_id, reason, missing_accessories
    Output: {
        order_id, item_total, freight_total,
        deduction, refund_amount,
        requires_escalation (bool), applicable_rule, note
    }
    """
    items = _get_order_items(order_id)
    if not items:
        return {
            "error": f"No items found for order '{order_id}'.",
            "order_id": order_id,
            "refund_amount": 0.0,
        }

    item_total = sum(float(i.get("price", 0) or 0) for i in items)
    freight_total = sum(float(i.get("freight_value", 0) or 0) for i in items)

    deduction = 0.0
    include_freight = False
    applicable_rule = "REF-05"

    reason_lower = reason.lower().strip()
    if reason_lower == "standard":
        # REF-07(a): standard returns do not get shipping refunded
        # REF-06: deduct 20% if missing accessories
        if missing_accessories:
            deduction = round(item_total * 0.20, 2)
            applicable_rule = "REF-06"
        include_freight = False

    elif reason_lower in ("damaged", "incorrect"):
        # REF-09: full refund of item price + original shipping
        include_freight = True
        applicable_rule = "REF-09"

    elif reason_lower == "missing":
        # REF-10: item price + proportional shipping (simplified: full freight
        # for single-item missing; proportional for multi-item handled upstream)
        include_freight = True
        applicable_rule = "REF-10"

    freight_refund = freight_total if include_freight else 0.0
    refund_amount = round(item_total + freight_refund - deduction, 2)

    requires_escalation = refund_amount > ESCALATION_REFUND_THRESHOLD

    return {
        "order_id": order_id,
        "reason": reason,
        "item_total": round(item_total, 2),
        "freight_total": round(freight_total, 2),
        "freight_refund": round(freight_refund, 2),
        "deduction": round(deduction, 2),
        "refund_amount": refund_amount,
        "requires_escalation": requires_escalation,
        "applicable_rule": applicable_rule,
        "note": (
            f"Refund > ${ESCALATION_REFUND_THRESHOLD:.0f}: must escalate to human (RET-17)."
            if requires_escalation
            else f"Refund ${refund_amount:.2f} approved under {applicable_rule}."
        ),
    }
