"""Pydantic schemas for request/response bodies."""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class CaseRequest(BaseModel):
    case_id: Optional[str] = Field(
        default=None,
        description="Optional case identifier; auto-generated if blank",
        examples=["CASE-001"],
    )
    order_id: str = Field(
        ...,
        description="Olist order ID",
        examples=["e481f51cbdc54678b7cc49136f2d6af7"],
    )
    customer_message: str = Field(
        ...,
        min_length=5,
        max_length=1000,
        description="Raw customer complaint or request",
        examples=["My product arrived damaged and I want a refund."],
    )
    simulated_days_post_delivery: Optional[int] = Field(
        default=None,
        description="Relative days offset from delivery date (defaults to 4 in historical sandbox)",
        examples=[4],
    )
    confidence_threshold: Optional[float] = Field(
        default=None,
        description="Custom System 1 confidence threshold (0.50 - 0.95, default 0.80)",
        examples=[0.80],
    )
    groq_api_key: Optional[str] = Field(
        default=None,
        description="Optional BYOK Groq API key for session",
    )


# ── Nested response models ────────────────────────────────────────────────────

class PolicyHit(BaseModel):
    policy_id: str
    policy_text: str
    source_file: str
    score: float


class GroqResult(BaseModel):
    interpretation: str
    recommended_action: str
    confidence: float
    needs_human: bool
    groq_model: Optional[str] = None
    error: Optional[str] = None


# ── Primary response ──────────────────────────────────────────────────────────

class CaseResponse(BaseModel):
    case_id: str
    order_id: str
    customer_message: str

    # Routing
    route: Optional[str] = None
    routing_confidence: Optional[float] = None
    routing_backend: Optional[str] = None

    # Resolution
    resolution: Optional[str] = None
    resolution_detail: Optional[str] = None
    escalate: bool = False
    escalate_reason: Optional[str] = None
    refund_amount: Optional[float] = None

    # Quality & Path
    confidence: float = 0.0
    groq_used: bool = False
    groq_result: Optional[GroqResult] = None
    execution_path: Optional[str] = "system_1_reflex"  # "system_1_reflex" | "system_2_deliberation"

    # Telemetry
    latency_ms: Optional[float] = None
    estimated_cost_usd: Optional[float] = 0.0000
    evaluation_reference_date: Optional[str] = None
    days_since_delivery: Optional[int] = None

    # Trace
    tools_executed: list[str] = []
    applicable_rules: list[str] = []
    retrieved_policies: list[PolicyHit] = []

    # Errors
    errors: list[str] = []


# ── Order lookup ──────────────────────────────────────────────────────────────

class OrderDetail(BaseModel):
    order_id: str
    order_status: Optional[str]
    purchase_date: Optional[str]
    estimated_delivery_date: Optional[str]
    delivery_date: Optional[str]
    is_delivered: bool
    is_late: bool
    days_late: int
    days_since_purchase: Optional[int]
    items: list[dict[str, Any]] = []
    payments: list[dict[str, Any]] = []
    customer: Optional[dict[str, Any]] = None


# ── Examples endpoint ─────────────────────────────────────────────────────────

class ExampleCase(BaseModel):
    case_id: str
    order_id: str
    customer_message: str
    scenario: str
    expected_route: str
    notes: str
    simulated_days_post_delivery: Optional[int] = 4
    expected_outcome: Optional[str] = None


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    engine_ready: bool
    olist_orders_loaded: int
    warnings: list[str] = []
