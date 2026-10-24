"""
GET /api/orders/{order_id}  — look up raw order data
GET /api/orders/search      — search order IDs by prefix
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.case import OrderDetail

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("/{order_id}", response_model=OrderDetail, summary="Look up an Olist order")
def get_order(order_id: str, request: Request):
    """Fetch raw order data from the Olist CSV layer."""
    repo = request.app.state.repo

    order = repo.get_order(order_id.strip())
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found")

    delivery = repo.get_delivery_status(order_id) or {}
    items = repo.get_order_items(order_id)
    payments = repo.get_payment(order_id)
    customer = repo.get_customer(order_id)

    return OrderDetail(
        order_id=order_id,
        order_status=order.get("order_status"),
        purchase_date=order.get("order_purchase_timestamp"),
        estimated_delivery_date=order.get("order_estimated_delivery_date"),
        delivery_date=order.get("order_delivered_customer_date"),
        is_delivered=bool(delivery.get("is_delivered", False)),
        is_late=bool(delivery.get("is_late", False)),
        days_late=int(delivery.get("days_late", 0)),
        days_since_purchase=delivery.get("days_since_purchase"),
        items=items,
        payments=payments,
        customer=customer,
    )


@router.get("", response_model=list[str], summary="Search order IDs by prefix")
def search_orders(
    q: str = Query(..., min_length=4, description="Order ID prefix (min 4 chars)"),
    limit: int = Query(default=10, ge=1, le=50),
    request: Request = None,
):
    """Return order IDs matching the given prefix (case-insensitive)."""
    loader = request.app.state.loader
    orders_df = loader.get_orders()

    prefix = q.strip().lower()
    matches = orders_df[orders_df["order_id"].str.lower().str.startswith(prefix)]["order_id"]
    return matches.head(limit).tolist()
