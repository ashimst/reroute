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
import uuid
from typing import Any, Literal, Optional

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph

log = logging.getLogger(__name__)


# ── State definition ──────────────────────────────────────────────────────────

class CaseState(TypedDict, total=False):
    # Input
    case_id: str
    order_id: str
    customer_message: str

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
    log.info(
        "[receive_case] case_id=%s  order_id=%s  message=%s…",
        new_state.get("case_id"),
        order_id,
        customer_message[:60],
    )
    return new_state


def jev_router(state: CaseState) -> CaseState:
    """Route the case using OpenJEV; fall back to Groq if confidence is low."""
    from src.routing.jev_router import route as jev_route
    from src.config import ROUTING_CONFIDENCE_THRESHOLD

    if state.get("errors"):
        return state   # don't route if input validation failed

    customer_message = state["customer_message"]
    result = jev_route(customer_message)

    log.info(
        "[jev_router] route=%s  confidence=%.2f  backend=%s  groq_needed=%s",
        result["route"],
        result["confidence"],
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
    result = returns.run(state["order_id"], state["customer_message"])
    return _merge_agent_result(state, result)


def delivery_agent(state: CaseState) -> CaseState:
    from src.agents import delivery
    result = delivery.run(state["order_id"], state["customer_message"])
    return _merge_agent_result(state, result)


def payment_agent(state: CaseState) -> CaseState:
    from src.agents import payment
    result = payment.run(state["order_id"], state["customer_message"])
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
        customer_message=state["customer_message"],
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
    """Merge agent + optional Groq results into the final resolution."""
    groq_result = state.get("groq_result")
    agent_escalate = state.get("agent_escalate", False)
    errors = state.get("errors") or []

    if errors:
        return {
            **state,
            "resolution": "error",
            "resolution_detail": "; ".join(errors),
            "escalate": True,
            "escalate_reason": "Input validation failed: " + "; ".join(errors),
            "confidence": 0.0,
        }

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

        return {
            **state,
            "resolution": resolution,
            "resolution_detail": detail,
            "escalate": escalate,
            "escalate_reason": "Groq recommended human escalation." if escalate else None,
            "confidence": groq_confidence,
        }

    # No Groq – use agent result directly
    return {
        **state,
        "resolution": state.get("agent_resolution", "unknown"),
        "resolution_detail": state.get("agent_resolution_detail", ""),
        "escalate": agent_escalate,
        "escalate_reason": state.get("agent_escalate_reason"),
        "confidence": state.get("agent_confidence", 0.0),
    }


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

    # If the agent already determined escalation (e.g. data error, missing order), resolve immediately
    if state.get("agent_escalate"):
        return "resolve"

    agent_confidence = state.get("agent_confidence", 0.0)
    needs_groq = state.get("agent_needs_groq", False)

    if needs_groq or agent_confidence < RESOLUTION_CONFIDENCE_THRESHOLD:
        log.info(
            "[evaluate_result] Confidence=%.2f < threshold=%.2f → Groq fallback",
            agent_confidence, RESOLUTION_CONFIDENCE_THRESHOLD,
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

def run_case(case_id: str, order_id: str, customer_message: str, app=None) -> CaseState:
    """
    Execute a complete case through the graph and return the final state.

    Args:
        case_id:          unique identifier for this exception case
        order_id:         Olist order ID
        customer_message: raw customer complaint / request
        app:              optional pre-compiled LangGraph application instance

    Returns:
        Final CaseState dict with all fields populated.
    """
    graph = app or get_compiled_graph()
    initial_state: CaseState = {
        "case_id": case_id,
        "order_id": order_id,
        "customer_message": customer_message,
        "errors": [],
        "groq_used": False,
        "groq_result": None,
    }
    final_state = graph.invoke(initial_state)
    return final_state

