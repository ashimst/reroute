"""
Repository layer – deterministic, LLM-free data access.

All functions return plain Python dicts/lists (never raw Pandas rows).
Missing IDs are handled gracefully by returning None or [].
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

import pandas as pd

import src.data.loader as _loader

log = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _ts(value: Any) -> Optional[str]:
    """Convert a Pandas Timestamp / NaT to ISO string or None."""
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    return str(value)


def _clean_val(val: Any) -> Any:
    """Convert pandas/numpy types to native Python primitives."""
    if pd.isna(val):
        return None
    if isinstance(val, (pd.Timestamp, datetime)):
        return _ts(val)
    if hasattr(val, "item"):
        try:
            return val.item()
        except (TypeError, ValueError):
            pass
    return val


def _row_to_dict(row: pd.Series) -> dict:
    """Convert a DataFrame row to a plain dict, normalising timestamps and numpy scalars."""
    result: dict = {}
    for col, val in row.items():
        result[col] = _clean_val(val)
    return result


def _parse_iso(iso: Optional[str]) -> Optional[datetime]:
    if iso is None:
        return None
    try:
        return datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return None


# ── Public repository functions ───────────────────────────────────────────────

def get_order(order_id: str) -> Optional[dict]:
    """
    Return a single order record by order_id, or None if not found.

    Output keys:
        order_id, customer_id, order_status,
        order_purchase_timestamp, order_approved_at,
        order_delivered_carrier_date, order_delivered_customer_date,
        order_estimated_delivery_date
    """
    df = _loader.get_orders()
    matches = df[df["order_id"] == order_id]
    if matches.empty:
        log.warning("get_order: order_id '%s' not found.", order_id)
        return None
    return _row_to_dict(matches.iloc[0])


def get_order_items(order_id: str) -> list[dict]:
    """
    Return all line items for an order, or [] if none found.

    Output keys per item:
        order_id, order_item_id, product_id, seller_id,
        shipping_limit_date, price, freight_value
    """
    df = _loader.get_order_items()
    matches = df[df["order_id"] == order_id]
    if matches.empty:
        log.warning("get_order_items: no items for order_id '%s'.", order_id)
        return []
    return [_row_to_dict(row) for _, row in matches.iterrows()]


def get_product(product_id: str) -> Optional[dict]:
    """
    Return a product record by product_id, or None if not found.

    Output keys:
        product_id, product_category_name, product_name_lenght,
        product_description_lenght, product_photos_qty,
        product_weight_g, product_length_cm, product_height_cm, product_width_cm
    """
    df = _loader.get_products()
    matches = df[df["product_id"] == product_id]
    if matches.empty:
        log.warning("get_product: product_id '%s' not found.", product_id)
        return None
    return _row_to_dict(matches.iloc[0])


def get_payment(order_id: str) -> list[dict]:
    """
    Return all payment records for an order, or [].

    Output keys per record:
        order_id, payment_sequential, payment_type,
        payment_installments, payment_value
    """
    df = _loader.get_payments()
    matches = df[df["order_id"] == order_id]
    if matches.empty:
        log.warning("get_payment: no payments for order_id '%s'.", order_id)
        return []
    return [_row_to_dict(row) for _, row in matches.iterrows()]


def get_customer(order_id: str) -> Optional[dict]:
    """
    Return the customer record for an order, or None if not found.

    Looks up customer_id from the orders table, then joins customers.
    Output keys:
        customer_id, customer_unique_id, customer_zip_code_prefix,
        customer_city, customer_state
    """
    order = get_order(order_id)
    if order is None:
        return None
    customer_id = order.get("customer_id")
    if not customer_id:
        return None
    df = _loader.get_customers()
    matches = df[df["customer_id"] == customer_id]
    if matches.empty:
        log.warning("get_customer: customer_id '%s' not found.", customer_id)
        return None
    return _row_to_dict(matches.iloc[0])


def get_delivery_status(order_id: str) -> Optional[dict]:
    """
    Return a structured delivery status summary for an order, or None.

    Derived deterministically from the orders table; no LLM involved.

    Output keys:
        order_id, order_status,
        purchase_date, ship_date, delivery_date, estimated_delivery_date,
        is_delivered, is_late, days_late, days_since_purchase
    """
    order = get_order(order_id)
    if order is None:
        return None

    try:
        from src.tools.time_anchor import _simulated_days_var, _simulated_eval_date_var
        sim_eval_dt = _simulated_eval_date_var.get()
        sim_days = _simulated_days_var.get()
    except Exception:
        sim_eval_dt = None
        sim_days = None

    purchase_date      = _parse_iso(order.get("order_purchase_timestamp"))
    ship_date          = _parse_iso(order.get("order_delivered_carrier_date"))
    delivery_date      = _parse_iso(order.get("order_delivered_customer_date"))
    estimated_delivery = _parse_iso(order.get("order_estimated_delivery_date"))

    is_delivered = delivery_date is not None
    is_late = False
    days_late = 0

    if sim_eval_dt:
        eval_dt = sim_eval_dt
    else:
        from datetime import timedelta
        offset = sim_days if sim_days is not None else 4
        base = delivery_date or ship_date or purchase_date or estimated_delivery
        eval_dt = (base + timedelta(days=offset)) if base else datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if estimated_delivery:
        reference = delivery_date if is_delivered else eval_dt
        if reference > estimated_delivery:
            is_late = True
            days_late = (reference - estimated_delivery).days

    days_since_purchase = (eval_dt - purchase_date).days if purchase_date else None

    return {
        "order_id": order_id,
        "order_status": order.get("order_status"),
        "purchase_date": order.get("order_purchase_timestamp"),
        "ship_date": order.get("order_delivered_carrier_date"),
        "delivery_date": order.get("order_delivered_customer_date"),
        "estimated_delivery_date": order.get("order_estimated_delivery_date"),
        "is_delivered": is_delivered,
        "is_late": is_late,
        "days_late": days_late,
        "days_since_purchase": days_since_purchase,
    }
