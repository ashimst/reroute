"""
Order tools – thin Cactus Needle wrappers around repository functions.

Each function is decorated with @needle.tool so Needle can pick it
up for tool-call routing. All logic is deterministic; no LLM involved.
"""

from __future__ import annotations

import logging
from typing import Optional

import needle

from src.data.repository import (
    get_customer as _get_customer,
    get_delivery_status as _get_delivery_status,
    get_order as _get_order,
    get_order_items as _get_order_items,
    get_payment as _get_payment,
    get_product as _get_product,
)

log = logging.getLogger(__name__)


@needle.tool
def get_order(order_id: str) -> dict:
    """Retrieve the full order record for the given order_id."""
    result = _get_order(order_id)
    if result is None:
        return {"error": f"Order '{order_id}' not found.", "order_id": order_id}
    return result


@needle.tool
def get_order_items(order_id: str) -> dict:
    """Retrieve all line items (products) for the given order_id."""
    items = _get_order_items(order_id)
    if not items:
        return {
            "error": f"No items found for order '{order_id}'.",
            "order_id": order_id,
            "items": [],
        }
    return {"order_id": order_id, "items": items, "item_count": len(items)}


@needle.tool
def get_product(product_id: str) -> dict:
    """Retrieve product details for the given product_id."""
    result = _get_product(product_id)
    if result is None:
        return {"error": f"Product '{product_id}' not found.", "product_id": product_id}
    return result


@needle.tool
def get_payment(order_id: str) -> dict:
    """Retrieve all payment records for the given order_id."""
    records = _get_payment(order_id)
    if not records:
        return {
            "error": f"No payment records found for order '{order_id}'.",
            "order_id": order_id,
            "payments": [],
        }
    total = sum(r.get("payment_value", 0) or 0 for r in records)
    return {
        "order_id": order_id,
        "payments": records,
        "total_paid": round(total, 2),
        "payment_count": len(records),
    }


@needle.tool
def get_delivery_status(order_id: str) -> dict:
    """Retrieve the delivery status and timing details for the given order_id."""
    result = _get_delivery_status(order_id)
    if result is None:
        return {
            "error": f"Order '{order_id}' not found.",
            "order_id": order_id,
        }
    return result
