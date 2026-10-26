"""
Custom PostgreSQL / Shopify Webhook Commerce Adapter Skeleton.

Demonstrates how an enterprise engineer plugs in a live PostgreSQL database,
Shopify Webhook, or Zendesk/Salesforce OMS into REROUTE in under 50 lines.
"""

from __future__ import annotations

import os
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


class CustomPostgresOrWebhookAdapter(BaseCommerceAdapter):
    """
    Connects REROUTE to an enterprise PostgreSQL database or Shopify GraphQL API.
    To activate: set COMMERCE_ADAPTER=custom in your .env file.
    """

    def __init__(self, connection_string: Optional[str] = None):
        self.connection_string = connection_string or os.getenv("DATABASE_URL")
        # e.g., self.db_pool = psycopg.AsyncConnectionPool(self.connection_string)

    def get_order_context(self, order_id: str) -> Optional[OrderContext]:
        # Example: SELECT * FROM orders JOIN items ON ... WHERE id = order_id
        # In a real deployment, query your primary database or Shopify REST/GraphQL:
        return OrderContext(
            order_id=order_id,
            customer_id="cust_enterprise_01",
            order_status="delivered",
            purchase_timestamp=datetime.utcnow(),
            delivery_timestamp=datetime.utcnow(),
            estimated_delivery_timestamp=datetime.utcnow(),
            carrier_tracking_code="1Z9999999999999999",
            items=[
                OrderItem(
                    item_id="item_01",
                    product_id="prod_sku_44",
                    product_name="Premium Ergonomic Chair",
                    category="furniture",
                    price=249.99,
                    freight_value=25.00,
                    quantity=1,
                )
            ],
            payments=[PaymentRecord(payment_type="stripe", installments=1, payment_value=274.99)],
        )

    def get_customer_history(self, customer_id: str) -> Optional[CustomerHistory]:
        # Example: SELECT count(*), sum(amount) FROM orders WHERE customer_id = ...
        return CustomerHistory(
            customer_id=customer_id,
            email="buyer@enterprise.com",
            lifetime_orders_count=14,
            lifetime_spend_brl=3450.00,
            return_rate_pct=0.07,
            risk_score=0.01,
        )

    def execute_resolution(self, order_id: str, decision: ResolutionDecision) -> ExecutionReceipt:
        # Example: POST to Shopify Admin API /api/refunds or Stripe /v1/refunds
        return ExecutionReceipt(
            receipt_id=f"LIVE-{uuid.uuid4().hex[:10].upper()}",
            order_id=order_id,
            status="dispatched",
            action_executed=decision.action,
            authorized_refund_amount=decision.refund_amount or 0.0,
            idempotency_key=f"PROD-{order_id}-{decision.case_id}",
            payload={"gateway": "stripe_charge_refund", "rules": decision.applicable_rule},
        )
