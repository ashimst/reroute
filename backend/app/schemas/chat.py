"""Pydantic schemas for the conversational chat endpoint."""

from __future__ import annotations
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Client-generated UUID for the session")
    messages: list[ChatMessage] = Field(..., min_length=1)
    order_id: Optional[str] = Field(
        default=None,
        description="If provided, order data is injected into every turn",
    )


# ── What the System-1 router decides ─────────────────────────────────────────
class IntentDecision(BaseModel):
    intent: Literal["tool_execution", "chat"]
    confidence: float
    detected_order_id: Optional[str] = None   # extracted from message if any
    reason: str


# ── A single SSE event payload ────────────────────────────────────────────────
class ChatChunk(BaseModel):
    type: Literal[
        "intent",       # System-1 decision
        "text",         # streaming text token(s)
        "tool_start",   # REROUTE engine starting
        "tool_result",  # engine finished – structured CaseResponse
        "done",         # stream complete
        "error",        # something went wrong
    ]
    content: Any = None
