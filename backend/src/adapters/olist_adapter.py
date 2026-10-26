"""
Olist Brazilian E-Commerce Sandbox Adapter.

Adapts the 99,441 real Olist e-commerce dataset into the clean
BaseCommerceAdapter protocol.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from src.adapters.base import (
    BaseCommerceAdapter,
    CustomerHistory,
    ExecutionReceipt,
    OrderContext,
    OrderItem,
    PaymentRecord,
    ResolutionDecision,
)
from src.data.repository import (
    get_customer,
    get_delivery_status,
    get_order,
    get_order_items,
    get_payment,
    get_products,
)


def _parse_dt(iso_str: Optional[str]) -> Optional[datetime]:
    if not iso_str:
        return None
    try:
        clean = iso_str.strip().replace("T", " ")[:19]
        return datetime.fromisoformat(clean)
    except Exception:
        return None


class OlistSandboxAdapter(BaseCommerceAdapter):
    """
    Production-grade Olist reference adapter.
    Translates raw pandas/CSV rows into strongly typed OrderContext and CustomerHistory.
    """

    def get_order_context(self, order_id: str) -> Optional[OrderContext]:
        order = get_order(order_id)
        if order is None:
            return None

        # Build items
        raw_items = get_order_items(order_id)
        items: list[OrderItem] = []
        for i in raw_items:
            items.append(
                OrderItem(
                    item_id=str(i.get("order_item_id", "1")),
                    product_id=str(i.get("product_id", "")),
                    product_name=str(i.get("product_id", ""))[:12],
                    category="general",
                    price=float(i.get("price", 0.0)),
                    freight_value=float(i.get("freight_value", 0.0)),
                    quantity=1,
                )
            )

        # Build payments
        raw_payments = get_payment(order_id)
        payments: list[PaymentRecord] = []
        for p in raw_payments:
            payments.append(
                PaymentRecord(
                    payment_type=str(p.get("payment_type", "credit_card")),
                    installments=int(p.get("payment_installments", 1)),
                    payment_value=float(p.get("payment_value", 0.0)),
                )
            )

        purchase_dt = _parse_dt(order.get("order_purchase_timestamp")) or datetime.utcnow()
        delivery_dt = _parse_dt(order.get("order_delivered_customer_date"))
        estimated_dt = _parse_dt(order.get("order_estimated_delivery_date"))

        return OrderContext(
            order_id=order_id,
            customer_id=str(order.get("customer_id", "")),
            order_status=str(order.get("order_status", "delivered")),
            purchase_timestamp=purchase_dt,
            delivery_timestamp=delivery_dt,
            estimated_delivery_timestamp=estimated_dt,
            carrier_tracking_code=f"BR-CORREIOS-{order_id[:8].upper()}",
            items=items,
            payments=payments,
        )

    def get_customer_history(self, customer_id: str) -> Optional[CustomerHistory]:
        cust = get_customer(customer_id)
        if cust is None:
            return None

        return CustomerHistory(
            customer_id=customer_id,
            customer_name=f"Customer {cust.get('customer_unique_id', '')[:8]}",
            email=f"{cust.get('customer_id', '')[:8]}@example-buyer.com.br",
            lifetime_orders_count=1,
            lifetime_spend_brl=150.0,
            return_rate_pct=0.0,
            risk_score=0.02,
        )

    def execute_resolution(self, order_id: str, decision: ResolutionDecision) -> ExecutionReceipt:
        # In sandbox mode, log the deterministic receipt
        status = "pending_approval" if decision.supervisor_escalate else "dispatched"
        authorized_amount = decision.refund_amount or 0.0

        return ExecutionReceipt(
            receipt_id=f"RCPT-{uuid.uuid4().hex[:10].upper()}",
            order_id=order_id,
            status=status,
            action_executed=decision.action,
            authorized_refund_amount=authorized_amount,
            idempotency_key=f"IDEMP-{order_id}-{decision.case_id}",
            payload={
                "rule": decision.applicable_rule,
                "reason": decision.reason,
                "simulated_ledger": "olist_sandbox",
            },
        )
