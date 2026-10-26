"""
LangGraph workflow – the top-level state machine for REROUTE.

Graph topology:
    START
      ↓
    receive_case          ← validate input, load order context
      ↓
    jev_router            ← OpenJEV typed routing decision
      ↓
    route_to_agent        ← conditional branch: returns / delivery / payment
      ↓ (one of three)
    returns_agent  |  delivery_agent  |  payment_agent
      ↓ (merge)
    evaluate_result       ← check confidence, decide next step
      ↓  (conditional)
    ┌── confident ──→ resolve
    └── uncertain ──→ groq_fallback ──→ resolve
      ↓
    resolve               ← build final result
      ↓
    END
"""

from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path
from typing import Any, Literal, Optional, TypedDict, cast

# Ensure backend root is on sys.path for consistent src.* resolution
_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from langgraph.graph import END, START, StateGraph

log = logging.getLogger(__name__)


# ── State definition ──────────────────────────────────────────────────────────

class CaseState(TypedDict, total=False):
    # Input
    case_id: str
    order_id: str
    customer_message: str
    simulated_days_post_delivery: Optional[int]
    simulated_evaluation_date: Optional[str]
    confidence_threshold: Optional[float]

    # Routing
    route: str                         # "returns" | "delivery" | "payment"
    routing_confidence: float
    routing_backend: str
    use_groq_fallback: bool

    # Policy retrieval (populated by agent)
    retrieved_policies: list[dict]

    # Tool execution (populated by agent)
    tool_results: dict

    # Agent output
    agent_resolution: str              # "approved" | "denied" | "escalated" | …
    agent_resolution_detail: str
    agent_confidence: float
    agent_needs_groq: bool
    agent_escalate: bool
    agent_escalate_reason: Optional[str]
    refund_amount: Optional[float]
    tools_executed: list[str]
    applicable_rules: list[str]

    # Groq fallback
    groq_result: Optional[dict]

    # Final output
    resolution: str
    resolution_detail: str
    escalate: bool
    escalate_reason: Optional[str]
    confidence: float
    groq_used: bool

    # Telemetry & Time-Anchoring
    evaluation_reference_date: Optional[str]
    days_since_delivery: Optional[int]
    execution_path: Optional[str]       # "system_1_reflex" | "system_2_deliberation"
    latency_ms: Optional[float]
    estimated_cost_usd: Optional[float]

    # Errors
    errors: list[str]


# ── Node implementations ──────────────────────────────────────────────────────

def receive_case(state: CaseState) -> CaseState:
    """Validate input and assign a case_id if missing."""
    new_state: CaseState = {**state}
    errors: list[str] = list(new_state.get("errors") or [])

    if not new_state.get("case_id"):
        new_state["case_id"] = f"CASE-{uuid.uuid4().hex[:8].upper()}"

    order_id = new_state.get("order_id", "").strip()
    if not order_id:
        errors.append("order_id is required.")

    customer_message = new_state.get("customer_message", "").strip()
    if not customer_message:
        errors.append("customer_message is required.")

    new_state["errors"] = errors

    # Initialize simulation contextvars for this thread
    from src.tools.time_anchor import set_simulation_context
    set_simulation_context(
        simulated_days=new_state.get("simulated_days_post_delivery"),
        simulated_eval_date=new_state.get("simulated_evaluation_date"),
        confidence_threshold=new_state.get("confidence_threshold"),
    )

    log.info(
        "[receive_case] case_id=%s  order_id=%s  days_offset=%s  threshold=%s",
        new_state.get("case_id"),
        order_id,
        new_state.get("simulated_days_post_delivery"),
        new_state.get("confidence_threshold"),
    )
    return new_state


def jev_router(state: CaseState) -> CaseState:
    """Route the case using OpenJEV; fall back to Groq if confidence is low."""
    from src.routing.jev_router import route as jev_route
    from src.config import ROUTING_CONFIDENCE_THRESHOLD

    if state.get("errors"):
        return state   # don't route if input validation failed

    customer_message = state.get("customer_message", "")
    result = jev_route(customer_message)

    # Dynamic thresholding: if custom threshold passed, use it
    configured_threshold = state.get("confidence_threshold")
    threshold = configured_threshold if configured_threshold is not None else ROUTING_CONFIDENCE_THRESHOLD
    if result["confidence"] < threshold:
        result["use_groq_fallback"] = True

    log.info(
        "[jev_router] route=%s  confidence=%.2f (threshold=%.2f) backend=%s  groq_needed=%s",
        result["route"],
        result["confidence"],
        threshold,
        result["backend_used"],
        result["use_groq_fallback"],
    )

    new_state: CaseState = {
        **state,
        "route": result["route"],
        "routing_confidence": result["confidence"],
        "routing_backend": result["backend_used"],
        "use_groq_fallback": result["use_groq_fallback"],
        "groq_used": False,
    }

    # If confidence too low, use Groq to classify the route
    if result["use_groq_fallback"]:
        log.info("[jev_router] Confidence below threshold – calling Groq for route classification.")
        from src.llm.groq_fallback import route_classify
        groq_cls = route_classify(customer_message)
        new_state["route"] = groq_cls.get("route", result["route"])
        new_state["routing_confidence"] = groq_cls.get("confidence", result["confidence"])
        new_state["groq_used"] = True
        log.info(
            "[jev_router] Groq classified route=%s  confidence=%.2f",
            new_state["route"], new_state["routing_confidence"],
        )

    return new_state


def returns_agent(state: CaseState) -> CaseState:
    from src.agents import returns
    result = returns.run(
        state.get("order_id", ""),
        state.get("customer_message", ""),
        simulated_days=state.get("simulated_days_post_delivery"),
    )
    return _merge_agent_result(state, result)


def delivery_agent(state: CaseState) -> CaseState:
    from src.agents import delivery
    result = delivery.run(
        state.get("order_id", ""),
        state.get("customer_message", ""),
        simulated_days=state.get("simulated_days_post_delivery"),
    )
    return _merge_agent_result(state, result)


def payment_agent(state: CaseState) -> CaseState:
    from src.agents import payment
    result = payment.run(
        state.get("order_id", ""),
        state.get("customer_message", ""),
        simulated_days=state.get("simulated_days_post_delivery"),
    )
    return _merge_agent_result(state, result)


def _merge_agent_result(state: CaseState, result: dict) -> CaseState:
    log.info(
        "[%s_agent] resolution=%s  confidence=%.2f  escalate=%s",
        result.get("agent", "?"),
        result.get("resolution"),
        result.get("confidence", 0.0),
        result.get("escalate"),
    )
    return {
        **state,
        "retrieved_policies": result.get("policies", []),
        "tool_results": result.get("tool_results", {}),
        "agent_resolution": result.get("resolution", "unknown"),
        "agent_resolution_detail": result.get("resolution_detail", ""),
        "agent_confidence": result.get("confidence", 0.0),
        "agent_needs_groq": result.get("needs_groq", False),
        "agent_escalate": result.get("escalate", False),
        "agent_escalate_reason": result.get("escalate_reason"),
        "refund_amount": result.get("refund_amount"),
        "tools_executed": result.get("tools_executed", []),
        "applicable_rules": result.get("applicable_rules", []),
    }


def groq_fallback_node(state: CaseState) -> CaseState:
    """Call Groq when agent confidence is insufficient."""
    from src.llm.groq_fallback import call as groq_call
    from src.data.repository import get_order

    log.info("[groq_fallback] Invoking Groq for order=%s", state.get("order_id"))

    order_info = get_order(state.get("order_id", "")) or {}
    policies = state.get("retrieved_policies") or []

    workflow_state = {
        "route": state.get("route"),
        "resolution": state.get("agent_resolution"),
        "confidence": state.get("agent_confidence"),
    }

    groq_result = groq_call(
        customer_message=state.get("customer_message", ""),
        order_info=order_info,
        policies=policies,
        workflow_state=workflow_state,
    )

    log.info(
        "[groq_fallback] recommended_action=%s  confidence=%.2f  needs_human=%s",
        groq_result.get("recommended_action"),
        groq_result.get("confidence", 0.0),
        groq_result.get("needs_human"),
    )

    return {**state, "groq_result": groq_result, "groq_used": True}


def resolve(state: CaseState) -> CaseState:
    """Merge agent + optional Groq results into the final resolution with time-anchoring telemetry."""
    from src.tools.time_anchor import get_order_evaluation_context
    order_id = state.get("order_id", "")
    offset = state.get("simulated_days_post_delivery")
    eval_dt, days_since_delivery, _ = get_order_evaluation_context(order_id, offset)

    groq_result = state.get("groq_result")
    agent_escalate = state.get("agent_escalate", False)
    errors = state.get("errors") or []
    groq_used = state.get("groq_used") is True
    execution_path = "system_2_deliberation" if groq_used else "system_1_reflex"
    estimated_cost = 0.0008 if groq_used else 0.0000

    res_state: CaseState = cast(CaseState, dict(state))
    res_state["evaluation_reference_date"] = eval_dt.date().isoformat()
    res_state["days_since_delivery"] = days_since_delivery
    res_state["execution_path"] = execution_path
    res_state["estimated_cost_usd"] = estimated_cost

    if errors:
        res_state["resolution"] = "error"
        res_state["resolution_detail"] = "; ".join(errors)
        res_state["escalate"] = True
        res_state["escalate_reason"] = "Input validation failed: " + "; ".join(errors)
        res_state["confidence"] = 0.0
        return res_state

    if groq_result:
        # Groq was consulted – use its recommendation
        recommended = groq_result.get("recommended_action", "escalate_to_human")
        needs_human = groq_result.get("needs_human", True)
        groq_confidence = groq_result.get("confidence", 0.0)

        # Map Groq action to resolution string
        action_map = {
            "approve_return":   "approved",
            "approve_refund":   "approved",
            "deny_return":      "denied",
            "inform_customer":  "informed",
            "investigate":      "investigation_required",
            "escalate_to_human": "escalated",
        }
        resolution = action_map.get(recommended, "escalated")
        escalate = needs_human or resolution == "escalated"
        detail = (
            groq_result.get("interpretation", "")
            + f" (Groq recommended: {recommended})"
        )

        res_state["resolution"] = resolution
        res_state["resolution_detail"] = detail
        res_state["escalate"] = escalate
        res_state["escalate_reason"] = "Groq recommended human escalation." if escalate else None
        res_state["confidence"] = groq_confidence
        return res_state

    # No Groq – use agent result directly
    res_state["resolution"] = state.get("agent_resolution", "unknown")
    res_state["resolution_detail"] = state.get("agent_resolution_detail", "")
    res_state["escalate"] = agent_escalate
    res_state["escalate_reason"] = state.get("agent_escalate_reason")
    res_state["confidence"] = state.get("agent_confidence", 0.0)
    return res_state


# ── Conditional routing functions ─────────────────────────────────────────────

def _pick_agent(state: CaseState) -> Literal["returns_agent", "delivery_agent", "payment_agent", "resolve"]:
    if state.get("errors"):
        return "resolve"
    route = (state.get("route") or "returns").lower()
    if route == "delivery":
        return "delivery_agent"
    if route == "payment":
        return "payment_agent"
    return "returns_agent"


def _evaluate_result(
    state: CaseState,
) -> Literal["groq_fallback_node", "resolve"]:
    from src.config import RESOLUTION_CONFIDENCE_THRESHOLD
    from src.tools.time_anchor import get_configured_confidence_threshold

    # If the agent already determined escalation (e.g. data error, missing order), resolve immediately
    if state.get("agent_escalate"):
        return "resolve"

    agent_confidence = state.get("agent_confidence", 0.0)
    needs_groq = state.get("agent_needs_groq", False)

    threshold = (
        state.get("confidence_threshold")
        or get_configured_confidence_threshold()
        or RESOLUTION_CONFIDENCE_THRESHOLD
    )

    if needs_groq or agent_confidence < threshold:
        log.info(
            "[evaluate_result] Confidence=%.2f < threshold=%.2f → Groq fallback",
            agent_confidence, threshold,
        )
        return "groq_fallback_node"

    return "resolve"


# ── Build the graph ───────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(CaseState)

    # Nodes
    g.add_node("receive_case", receive_case)
    g.add_node("jev_router", jev_router)
    g.add_node("returns_agent", returns_agent)
    g.add_node("delivery_agent", delivery_agent)
    g.add_node("payment_agent", payment_agent)
    g.add_node("groq_fallback_node", groq_fallback_node)
    g.add_node("resolve", resolve)

    # Edges
    g.add_edge(START, "receive_case")
    g.add_edge("receive_case", "jev_router")

    g.add_conditional_edges(
        "jev_router",
        _pick_agent,
        {
            "returns_agent": "returns_agent",
            "delivery_agent": "delivery_agent",
            "payment_agent": "payment_agent",
            "resolve": "resolve",
        },
    )

    for agent_node in ("returns_agent", "delivery_agent", "payment_agent"):
        g.add_conditional_edges(
            agent_node,
            _evaluate_result,
            {
                "groq_fallback_node": "groq_fallback_node",
                "resolve": "resolve",
            },
        )

    g.add_edge("groq_fallback_node", "resolve")
    g.add_edge("resolve", END)

    return g


_COMPILED_GRAPH = None


def get_compiled_graph():
    """Return the cached compiled LangGraph instance, compiling on first access."""
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH = build_graph().compile()
    return _COMPILED_GRAPH


def build_compiled_graph():
    """Compile and return a runnable LangGraph instance."""
    return get_compiled_graph()


# ── Convenience runner ────────────────────────────────────────────────────────

def run_case(
    case_id: str,
    order_id: str,
    customer_message: str,
    app=None,
    simulated_days_post_delivery: Optional[int] = None,
    simulated_evaluation_date: Optional[str] = None,
    confidence_threshold: Optional[float] = None,
) -> CaseState:
    """
    Execute a complete case through the graph and return the final state.

    Args:
        case_id:                      unique identifier for this exception case
        order_id:                     Olist order ID
        customer_message:             raw customer complaint / request
        app:                          optional pre-compiled LangGraph application instance
        simulated_days_post_delivery: relative days offset from delivery date (default 4)
        simulated_evaluation_date:    optional explicit ISO date override
        confidence_threshold:         custom System 1 confidence threshold (0.50 - 0.95)

    Returns:
        Final CaseState dict with all fields and telemetry populated.
    """
    import time
    start_time = time.perf_counter()

    graph = app or get_compiled_graph()
    initial_state: CaseState = {
        "case_id": case_id,
        "order_id": order_id,
        "customer_message": customer_message,
        "simulated_days_post_delivery": simulated_days_post_delivery,
        "simulated_evaluation_date": simulated_evaluation_date,
        "confidence_threshold": confidence_threshold,
        "errors": [],
        "groq_used": False,
        "groq_result": None,
    }
    final_state = graph.invoke(initial_state)

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0
    final_state["latency_ms"] = round(elapsed_ms, 2)
    return cast(CaseState, final_state)


