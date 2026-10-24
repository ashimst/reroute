"""
REROUTE – Retail Flow Exception Routing and Resolution Engine
=============================================================

Usage:
    # Run all example cases:
    python main.py

    # Run a single case interactively:
    python main.py --order-id <ORDER_ID> --message "My product arrived damaged."

    # Run a specific example case by case_id:
    python main.py --case CASE-001

    # Run all examples and write output to a file:
    python main.py --output results.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import textwrap
from pathlib import Path

# Force UTF-8 output on Windows to avoid cp1252 encode errors
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── Logging setup (before any local imports) ─────────────────────────────────
logging.basicConfig(
    level=logging.WARNING,          # suppress library noise by default
    format="%(levelname)s  %(name)s  %(message)s",
)
# Show our own modules at INFO
for _mod in ("src.graph", "src.routing", "src.agents", "src.llm", "src.rag"):
    logging.getLogger(_mod).setLevel(logging.INFO)

# ── Project root on sys.path ──────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT))

from src.config import validate as _validate_config
from src.graph.workflow import run_case


# ── Pretty printer ────────────────────────────────────────────────────────────

_SEP = "-" * 60


def _wrap(text: str, width: int = 70, indent: str = "  ") -> str:
    return textwrap.fill(str(text), width=width, initial_indent=indent,
                         subsequent_indent=indent)


def print_result(state: dict) -> None:
    """Print a readable, structured summary of a completed case."""
    print()
    print(_SEP)
    print(f"  Case:     {state.get('case_id', 'N/A')}")
    print(f"  Order:    {state.get('order_id', 'N/A')}")
    print()
    print(_wrap(f"Message: {state.get('customer_message', '')}", indent="  "))
    print()

    # Routing
    print(f"  Route:    {state.get('route', 'N/A').upper()}")
    print(f"  Routing confidence: {state.get('routing_confidence', 0.0):.0%}  "
          f"(backend: {state.get('routing_backend', 'N/A')})")
    print()

    # Policies retrieved
    policies = state.get("retrieved_policies") or []
    if policies:
        print("  Relevant policies:")
        for p in policies:
            print(f"    * [{p['policy_id']}]  score={p['score']:.2f}  "
                  f"({p['source_file']})")
    else:
        print("  Relevant policies:  none retrieved")
    print()

    # Tools executed
    tools = state.get("tools_executed") or []
    if tools:
        print("  Tools executed:")
        for t in tools:
            print(f"    * {t}")
    else:
        print("  Tools executed:  none")
    print()

    # Applicable rules
    rules = [r for r in (state.get("applicable_rules") or []) if r]
    if rules:
        print(f"  Applicable rules: {', '.join(rules)}")
    print()

    # Resolution
    resolution = state.get("resolution", "unknown").upper()
    detail = state.get("resolution_detail", "")
    print(f"  Resolution:  {resolution}")
    if detail:
        print(_wrap(detail, indent="    "))
    print()

    # Refund amount
    refund = state.get("refund_amount")
    if refund is not None:
        print(f"  Refund amount:  ${refund:.2f}")
        print()

    # Escalation
    escalate = state.get("escalate", False)
    escalate_reason = state.get("escalate_reason", "")
    print(f"  Escalated:  {'YES ⚠' if escalate else 'No'}")
    if escalate and escalate_reason:
        print(_wrap(f"Reason: {escalate_reason}", indent="    "))
    print()

    # Groq
    groq_used = state.get("groq_used", False)
    print(f"  Groq used:  {'Yes' if groq_used else 'No'}")
    if groq_used and state.get("groq_result"):
        gr = state["groq_result"]
        print(f"    Interpretation: {gr.get('interpretation', '')}")
        print(f"    Recommended:    {gr.get('recommended_action', '')}")
        print(f"    Confidence:     {gr.get('confidence', 0.0):.0%}")

    print()
    print(f"  Final confidence:  {state.get('confidence', 0.0):.0%}")

    errors = state.get("errors") or []
    if errors:
        print()
        print("  ERRORS:")
        for e in errors:
            print(f"    ! {e}")

    print(_SEP)


# ── Case runner ───────────────────────────────────────────────────────────────

def run_single(case_id: str, order_id: str, message: str) -> dict:
    print(f"\nRunning case {case_id} ...")
    try:
        state = run_case(case_id, order_id, message)
    except Exception as exc:
        logging.exception("Unhandled error running case %s", case_id)
        state = {
            "case_id": case_id,
            "order_id": order_id,
            "customer_message": message,
            "resolution": "error",
            "resolution_detail": str(exc),
            "escalate": True,
            "escalate_reason": str(exc),
            "confidence": 0.0,
            "groq_used": False,
            "errors": [str(exc)],
        }
    print_result(state)
    return state


def run_examples(case_filter: str | None = None) -> list[dict]:
    examples_file = _ROOT / "examples" / "cases.json"
    if not examples_file.exists():
        print(f"ERROR: examples file not found at {examples_file}")
        sys.exit(1)

    cases = json.loads(examples_file.read_text(encoding="utf-8"))

    if case_filter:
        cases = [c for c in cases if c["case_id"] == case_filter]
        if not cases:
            print(f"ERROR: case '{case_filter}' not found in examples/cases.json")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  REROUTE - Retail Flow Exception Routing Engine")
    print(f"  Running {len(cases)} example case(s)")
    print(f"{'='*60}")

    results = []
    for case in cases:
        state = run_single(
            case_id=case["case_id"],
            order_id=case["order_id"],
            message=case["customer_message"],
        )
        # Annotate with scenario metadata
        state["_scenario"] = case.get("scenario", "")
        state["_expected_route"] = case.get("expected_route", "")
        state["_notes"] = case.get("notes", "")
        results.append(state)

    # Summary table
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    print(f"  {'Case':<12}  {'Route':<10}  {'Resolution':<22}  {'Esc':<4}  {'Groq'}")
    print(f"  {'-'*12}  {'-'*10}  {'-'*22}  {'-'*4}  {'-'*4}")
    for s in results:
        print(
            f"  {s.get('case_id',''):<12}  "
            f"{str(s.get('route','')).upper():<10}  "
            f"{str(s.get('resolution','')):<22}  "
            f"{'YES' if s.get('escalate') else 'no':<4}  "
            f"{'yes' if s.get('groq_used') else 'no'}"
        )
    print(f"{'='*60}\n")

    return results


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # Print config warnings
    for w in _validate_config():
        print(f"[CONFIG WARNING] {w}")

    parser = argparse.ArgumentParser(
        description="REROUTE – Retail Flow Exception Routing Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          python main.py
          python main.py --case CASE-001
          python main.py --order-id e481f51cbdc54678b7cc49136f2d6af7 --message "My product arrived damaged."
          python main.py --output results.json
        """),
    )
    parser.add_argument("--order-id", help="Olist order ID to process")
    parser.add_argument("--message", help="Customer exception message")
    parser.add_argument("--case-id", default="ADHOC-001",
                        help="Case ID for ad-hoc run (default: ADHOC-001)")
    parser.add_argument("--case", help="Run a specific example case by case_id")
    parser.add_argument("--output", help="Write results to this JSON file")
    parser.add_argument("--debug", action="store_true",
                        help="Enable DEBUG logging")

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        for _mod in ("src.graph", "src.routing", "src.agents", "src.llm", "src.rag",
                     "src.data", "src.tools"):
            logging.getLogger(_mod).setLevel(logging.DEBUG)

    # Ad-hoc single case
    if args.order_id and args.message:
        state = run_single(args.case_id, args.order_id, args.message)
        results = [state]
    else:
        # Run example cases (all or filtered by --case)
        results = run_examples(case_filter=args.case)

    # Optional output
    if args.output:
        out_path = Path(args.output)
        # Make state serialisable (remove non-serialisable objects)
        def _clean(obj):
            if isinstance(obj, dict):
                return {k: _clean(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_clean(i) for i in obj]
            try:
                json.dumps(obj)
                return obj
            except (TypeError, ValueError):
                return str(obj)

        out_path.write_text(
            json.dumps([_clean(r) for r in results], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Results written to {out_path}")


if __name__ == "__main__":
    main()
