"""
Time-anchoring module for historical Olist dataset sandbox.

Because the Olist dataset spans 2016–2018, evaluating claims against
the wall-clock datetime.now() causes every return window to appear 2,500+ days expired.
This module anchors evaluations relative to the actual order delivery date
(or purchase timestamp if undelivered), allowing realistic deterministic evaluation
of return windows, carrier delays, and SLA rules.
"""

from __future__ import annotations

import contextvars
from datetime import datetime, timedelta
from typing import Optional

from src.data.repository import get_delivery_status, get_order

# Per-request context variables
_simulated_days_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "_simulated_days_var", default=None
)
_simulated_eval_date_var: contextvars.ContextVar[Optional[datetime]] = contextvars.ContextVar(
    "_simulated_eval_date_var", default=None
)
_simulated_confidence_threshold_var: contextvars.ContextVar[Optional[float]] = contextvars.ContextVar(
    "_simulated_confidence_threshold_var", default=None
)


def set_simulation_context(
    simulated_days: Optional[int] = None,
    simulated_eval_date: Optional[str] = None,
    confidence_threshold: Optional[float] = None,
) -> None:
    """Set simulation context for the current async task / thread."""
    _simulated_days_var.set(simulated_days)
    if simulated_eval_date:
        try:
            dt = datetime.fromisoformat(simulated_eval_date.replace("Z", "+00:00"))
            _simulated_eval_date_var.set(dt.replace(hour=0, minute=0, second=0, microsecond=0))
        except Exception:
            _simulated_eval_date_var.set(None)
    else:
        _simulated_eval_date_var.set(None)

    _simulated_confidence_threshold_var.set(confidence_threshold)


def get_configured_confidence_threshold() -> Optional[float]:
    """Return user-configured confidence threshold override or None."""
    return _simulated_confidence_threshold_var.get()


def _parse_iso(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        # Handle string slice up to 19 chars: 'YYYY-MM-DD HH:MM:SS'
        clean = iso.strip().replace("T", " ")[:19]
        return datetime.fromisoformat(clean).replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return None


def get_order_evaluation_context(
    order_id: str,
    explicit_days_offset: Optional[int] = None,
) -> tuple[datetime, int, Optional[str]]:
    """
    Compute the relative evaluation anchor for an order.

    If simulation context or explicit_days_offset is provided, calculates
    evaluation date anchored relative to the order milestone.
    Otherwise, evaluates against real wall-clock datetime.now() for historical testing.

    Returns:
        (evaluation_datetime, days_since_delivery_or_purchase, delivery_date_iso)
    """
    # 1. Check if an explicit evaluation date was configured
    forced_date = _simulated_eval_date_var.get()
    if forced_date:
        return forced_date, 0, None

    # 2. Determine offset: explicit argument > contextvar
    offset = explicit_days_offset
    if offset is None:
        offset = _simulated_days_var.get()

    # 3. Retrieve order timeline
    delivery = get_delivery_status(order_id)
    if delivery is None:
        eval_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return eval_dt, offset if offset is not None else 0, None

    delivery_iso = delivery.get("delivery_date")
    delivery_dt = _parse_iso(delivery_iso)

    # 4. If simulated offset is active, anchor relative to milestone
    if offset is not None:
        if delivery_dt is not None:
            eval_dt = delivery_dt + timedelta(days=offset)
            return eval_dt, offset, delivery_iso

        purchase_iso = delivery.get("purchase_date")
        purchase_dt = _parse_iso(purchase_iso)
        if purchase_dt is not None:
            eval_dt = purchase_dt + timedelta(days=offset)
            return eval_dt, offset, None

        eval_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return eval_dt, offset, None

    # 5. Fallback for raw historical evaluation (e.g. non-simulated unit tests)
    now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if delivery_dt is not None:
        actual_days = max(0, (now - delivery_dt).days)
        return now, actual_days, delivery_iso

    purchase_iso = delivery.get("purchase_date")
    purchase_dt = _parse_iso(purchase_iso)
    if purchase_dt is not None:
        actual_days = max(0, (now - purchase_dt).days)
        return now, actual_days, None

    return now, 0, None
