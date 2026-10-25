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


def _get_repo(request: Request):
    from src.data import repository as _repo
    return getattr(request.app.state, "repo", None) or _repo


def _get_loader(request: Request):
    from src.data import loader as _loader
    return getattr(request.app.state, "loader", None) or _loader


@router.get("/{order_id}", response_model=OrderDetail, summary="Look up an Olist order")
def get_order(order_id: str, request: Request):
    """Fetch raw order data from the Olist CSV layer."""
    repo = _get_repo(request)

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
    request: Request,
    q: str = Query(..., min_length=4, description="Order ID prefix (min 4 chars)"),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Return order IDs matching the given prefix (case-insensitive)."""
    loader = _get_loader(request)
    orders_df = loader.get_orders()

    prefix = q.strip().lower()
    matches = orders_df[orders_df["order_id"].str.lower().str.startswith(prefix)]["order_id"]
    return matches.head(limit).tolist()


@router.get("/products/{product_id}", summary="Look up an Olist product by ID")
def get_product_detail(product_id: str, request: Request):
    """Fetch product metadata (category, weight, dimensions) by product_id."""
    repo = _get_repo(request)
    product = repo.get_product(product_id.strip())
    if product is None:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    return product

