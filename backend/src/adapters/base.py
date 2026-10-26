"""
Base commerce adapter interface for REROUTE.

Defines the pluggable protocol for integrating REROUTE with any e-commerce
order management system (OMS), ERP, or database:
  - Olist Brazilian E-Commerce (built-in open-source reference)
  - Shopify / Shopify Plus Webhooks & GraphQL Admin API
  - BigCommerce / WooCommerce Webhooks
  - Internal PostgreSQL / MySQL / MongoDB enterprise databases
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class OrderItem:
    item_id: str
    product_id: str
    product_name: str
    category: str
    price: float
    freight_value: float
    quantity: int = 1


@dataclass
class PaymentRecord:
    payment_type: str
    installments: int
    payment_value: float
    status: str = "captured"


@dataclass
class CustomerHistory:
    customer_id: str
    customer_name: Optional[str] = None
    email: Optional[str] = None
    lifetime_orders_count: int = 1
    lifetime_spend_brl: float = 0.0
    return_rate_pct: float = 0.0
    risk_score: float = 0.0  # 0.0 (safe) to 1.0 (fraud risk)


@dataclass
class OrderContext:
    order_id: str
    customer_id: str
    order_status: str  # "delivered", "shipped", "canceled", "processing"
    purchase_timestamp: datetime
    delivery_timestamp: Optional[datetime] = None
    estimated_delivery_timestamp: Optional[datetime] = None
    carrier_tracking_code: Optional[str] = None
    items: list[OrderItem] = field(default_factory=list)
    payments: list[PaymentRecord] = field(default_factory=list)
    shipping_address: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def total_order_value(self) -> float:
        return sum(item.price * item.quantity for item in self.items)

    @property
    def total_freight_value(self) -> float:
        return sum(item.freight_value for item in self.items)


@dataclass
class ResolutionDecision:
    case_id: str
    order_id: str
    route: str  # "returns" | "delivery" | "payment"
    action: str  # "approved" | "denied" | "escalated" | "store_credit"
    refund_amount: Optional[float] = None
    applicable_rule: Optional[str] = None
    reason: Optional[str] = None
    supervisor_escalate: bool = False


@dataclass
class ExecutionReceipt:
    receipt_id: str
    order_id: str
    status: str  # "dispatched", "pending_approval", "rejected"
    action_executed: str
    authorized_refund_amount: float
    idempotency_key: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    payload: dict[str, Any] = field(default_factory=dict)


class BaseCommerceAdapter(ABC):
    """
    Abstract interface every e-commerce adapter must implement.
    Swapping Olist for Shopify, BigCommerce, or PostgreSQL takes <50 lines of Python.
    """

    @abstractmethod
    def get_order_context(self, order_id: str) -> Optional[OrderContext]:
        """
        Fetch normalized order context, items, milestones, and payment records.
        """
        pass

    @abstractmethod
    def get_customer_history(self, customer_id: str) -> Optional[CustomerHistory]:
        """
        Fetch customer lifetime value, return rates, and fraud risk profile.
        """
        pass

    @abstractmethod
    def execute_resolution(self, order_id: str, decision: ResolutionDecision) -> ExecutionReceipt:
        """
        Dispatch the deterministic decision to the external OMS/ERP or gateway
        (e.g., Stripe refund, Shopify return label, or store credit creation).
        """
        pass
