"""
Delivery tools – deterministic status and delay analysis.

Rules applied:
    DEL-03  EDD calculation
    DEL-06  late = delivery_date null AND today > EDD
    DEL-07  1–3 days late: inform only
    DEL-08  4–7 days late: $5 store credit on request
    DEL-09  >7 days late: refund shipping or $10 credit
    DEL-11  Stuck-in-transit thresholds (5 / 10 days since last scan)
    DEL-12  Marked delivered but missing: 7-day report window
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import needle

from src.config import (
    DELIVERY_STANDARD_DAYS,
    ESCALATION_REFUND_THRESHOLD,
    MISSING_DELIVERY_REPORT_DAYS,
    TRANSIT_REFUND_DAYS,
    TRANSIT_STUCK_DAYS,
)
from src.data.repository import (
    get_delivery_status as _get_delivery_status,
    get_order as _get_order,
)

log = logging.getLogger(__name__)


def _today() -> datetime:
    return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)


def _parse(iso: Optional[str]) -> Optional[datetime]:
    if iso is None:
        return None
    try:
        return datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return None


@needle.tool
def check_delivery_status(order_id: str) -> dict:
    """
    Return the full delivery status summary for an order.

    Input:  order_id (str)
    Output: full delivery status dict from repository plus human-readable status_label.
    """
    result = _get_delivery_status(order_id)
    if result is None:
        return {"error": f"Order '{order_id}' not found.", "order_id": order_id}

    status = result.get("order_status", "unknown")
    delivered = result.get("is_delivered", False)
    is_late = result.get("is_late", False)
    days_late = result.get("days_late", 0)

    if delivered and not is_late:
        label = "Delivered on time"
    elif delivered and is_late:
        label = f"Delivered late ({days_late} days)"
    elif not delivered and is_late:
        label = f"Not yet delivered – {days_late} days past EDD"
    else:
        label = f"In progress – status: {status}"

    return {**result, "status_label": label}


@needle.tool
def check_delivery_delay(order_id: str) -> dict:
    """
    Analyse delivery delay and return the applicable policy action.

    Input:  order_id (str)
    Output: {
        order_id, is_late, days_late,
        action (str), compensation (str|None),
        escalate (bool), applicable_rule (str), note (str)
    }
    """
    delivery = _get_delivery_status(order_id)
    if delivery is None:
        return {
            "error": f"Order '{order_id}' not found.",
            "order_id": order_id,
            "escalate": True,
        }

    is_late = delivery.get("is_late", False)
    days_late = delivery.get("days_late", 0)
    order_status = delivery.get("order_status", "")
    is_delivered = delivery.get("is_delivered", False)

    if not is_late:
        return {
            "order_id": order_id,
            "is_late": False,
            "days_late": 0,
            "action": "no_action",
            "compensation": None,
            "escalate": False,
            "applicable_rule": "DEL-06",
            "note": "Order is on time. No delay compensation required.",
        }

    # Classify delay band
    if 1 <= days_late <= 3:
        return {
            "order_id": order_id,
            "is_late": True,
            "days_late": days_late,
            "action": "inform_customer",
            "compensation": None,
            "escalate": False,
            "applicable_rule": "DEL-07",
            "note": f"Minor delay ({days_late} days). Inform customer; no compensation.",
        }

    if 4 <= days_late <= 7:
        return {
            "order_id": order_id,
            "is_late": True,
            "days_late": days_late,
            "action": "issue_store_credit",
            "compensation": "$5 store credit on request",
            "escalate": False,
            "applicable_rule": "DEL-08",
            "note": f"Moderate delay ({days_late} days). Issue $5 store credit on request.",
        }

    # days_late > 7
    return {
        "order_id": order_id,
        "is_late": True,
        "days_late": days_late,
        "action": "refund_shipping_or_credit",
        "compensation": "Shipping refund (if paid) or $10 store credit (if free shipping)",
        "escalate": False,
        "applicable_rule": "DEL-09",
        "note": (
            f"Significant delay ({days_late} days). "
            "Refund original shipping or issue $10 credit. "
            "Customer may cancel for full refund if not yet delivered."
        ),
    }
