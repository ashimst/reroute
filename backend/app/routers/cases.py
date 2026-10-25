"""
POST /api/cases  — submit a customer exception case
GET  /api/cases/examples — return the 15 bundled example cases
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from app.schemas.case import CaseRequest, CaseResponse, ExampleCase, GroqResult, PolicyHit

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cases", tags=["cases"])

def _find_examples_file() -> Path:
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "examples" / "cases.json",
        Path(__file__).resolve().parent.parent / "examples" / "cases.json",
        Path("backend/examples/cases.json").resolve(),
        Path("examples/cases.json").resolve(),
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]

_EXAMPLES_FILE = _find_examples_file()


def _clean_state(state: Any) -> dict:
    """Strip non-serialisable objects from a CaseState dict."""
    def _safe(v):
        if isinstance(v, dict):
            return {k: _safe(vv) for k, vv in v.items()}
        if isinstance(v, list):
            return [_safe(i) for i in v]
        try:
            json.dumps(v)
            return v
        except (TypeError, ValueError):
            return str(v)
    return _safe(state)


def _build_response(state: dict) -> CaseResponse:
    """Convert a raw CaseState dict into a typed CaseResponse."""
    policies = [
        PolicyHit(
            policy_id=p.get("policy_id", ""),
            policy_text=p.get("policy_text", ""),
            source_file=p.get("source_file", ""),
            score=float(p.get("score", 0.0)),
        )
        for p in (state.get("retrieved_policies") or [])
    ]

    groq_raw = state.get("groq_result")
    groq_model: GroqResult | None = None
    if groq_raw:
        groq_model = GroqResult(
            interpretation=groq_raw.get("interpretation", ""),
            recommended_action=groq_raw.get("recommended_action", ""),
            confidence=float(groq_raw.get("confidence", 0.0)),
            needs_human=bool(groq_raw.get("needs_human", False)),
            groq_model=groq_raw.get("groq_model"),
            error=groq_raw.get("error"),
        )

    return CaseResponse(
        case_id=state.get("case_id", ""),
        order_id=state.get("order_id", ""),
        customer_message=state.get("customer_message", ""),
        route=state.get("route"),
        routing_confidence=state.get("routing_confidence"),
        routing_backend=state.get("routing_backend"),
        resolution=state.get("resolution"),
        resolution_detail=state.get("resolution_detail"),
        escalate=bool(state.get("escalate", False)),
        escalate_reason=state.get("escalate_reason"),
        refund_amount=state.get("refund_amount"),
        confidence=float(state.get("confidence", 0.0)),
        groq_used=bool(state.get("groq_used", False)),
        groq_result=groq_model,
        tools_executed=list(state.get("tools_executed") or []),
        applicable_rules=list(state.get("applicable_rules") or []),
        retrieved_policies=policies,
        errors=list(state.get("errors") or []),
    )


@router.post("", response_model=CaseResponse, summary="Submit an exception case")
async def submit_case(body: CaseRequest, request: Request):
    """
    Run the full REROUTE pipeline on a customer exception.

    - Routes through OpenJEV / keyword classifier
    - Retrieves relevant policy via FAISS semantic search
    - Executes deterministic tools via Cactus Needle
    - Falls back to Groq if confidence is below threshold
    """
    from src.graph.workflow import run_case as _default_run_case
    run_case = getattr(request.app.state, "run_case", None) or _default_run_case

    case_id = body.case_id or f"WEB-{uuid.uuid4().hex[:8].upper()}"

    # Return request quota enforcement for Free Tier accounts
    is_return_issue = any(k in body.customer_message.lower() for k in ["return", "refund", "damaged", "broken", "defective", "smashed"])
    if is_return_issue:
        from app.routers.auth import get_current_user_optional, check_and_increment_return_quota
        auth_header = request.headers.get("authorization")
        user = get_current_user_optional(auth_header)
        quota = check_and_increment_return_quota(user)
        if not quota["allowed"]:
            raise HTTPException(status_code=429, detail=quota["message"])

    try:
        state = await asyncio.to_thread(
            run_case,
            case_id,
            body.order_id.strip(),
            body.customer_message.strip(),
        )
    except Exception as exc:
        log.exception("run_case failed for order_id=%s", body.order_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _build_response(_clean_state(state))


@router.get("/examples", response_model=list[ExampleCase], summary="List bundled example cases")
def get_examples():
    """Return the 15 pre-built example cases from examples/cases.json."""
    examples_file = _find_examples_file()
    if not examples_file.exists():
        raise HTTPException(status_code=404, detail="examples/cases.json not found")
    data = json.loads(examples_file.read_text(encoding="utf-8"))
    return [ExampleCase(**c) for c in data]

