"""
Central configuration for REROUTE.
All settings are read from environment variables (via .env).
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Locate project root and load .env ────────────────────────────────────────
_HERE = Path(__file__).resolve().parent.parent          # reroute/
_ENV_FILE = _HERE / ".env"
load_dotenv(_ENV_FILE, override=False)                  # does not override shell env


# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

# ── OpenJEV ───────────────────────────────────────────────────────────────────
OPENJEV_BACKEND: str = os.getenv("OPENJEV_BACKEND", "mock")
OPENJEV_HF_MODEL: str = os.getenv("OPENJEV_HF_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")

# ── Thresholds ────────────────────────────────────────────────────────────────
# Below this routing confidence → fall back to Groq for classification
ROUTING_CONFIDENCE_THRESHOLD: float = float(
    os.getenv("ROUTING_CONFIDENCE_THRESHOLD", "0.6")
)
# Below this resolution confidence → escalate to human
RESOLUTION_CONFIDENCE_THRESHOLD: float = float(
    os.getenv("RESOLUTION_CONFIDENCE_THRESHOLD", "0.5")
)

# ── Data paths ────────────────────────────────────────────────────────────────
OLIST_DATA_DIR: Path = _HERE / os.getenv("OLIST_DATA_DIR", "data/olist")
POLICY_DIR: Path = _HERE / os.getenv("POLICY_DIR", "data/policies")
VECTOR_STORE_PATH: Path = _HERE / os.getenv("VECTOR_STORE_PATH", "data/policy_index")

# ── Return / refund business rules (deterministic) ───────────────────────────
RETURN_WINDOW_DAYS: int = 30          # RET-02
DAMAGED_REPORT_DAYS: int = 7          # RET-09
INCORRECT_REPORT_DAYS: int = 14       # RET-11
MISSING_REPORT_DAYS: int = 14         # RET-12
ESCALATION_REFUND_THRESHOLD: float = 500.0   # RET-17 / REF-15(a)
DEDUCTION_RATE: float = 0.20          # REF-06 – missing accessories

# ── Delivery business rules ───────────────────────────────────────────────────
DELIVERY_STANDARD_DAYS: int = 7       # DEL-03
DELIVERY_EXPEDITED_DAYS: int = 3      # DEL-03
TRANSIT_STUCK_DAYS: int = 5           # DEL-11 – open carrier trace
TRANSIT_REFUND_DAYS: int = 10         # DEL-11 – process full refund
MISSING_DELIVERY_REPORT_DAYS: int = 7 # DEL-12

# ── Routes supported by the routing layer ────────────────────────────────────
VALID_ROUTES = ("returns", "delivery", "payment")

# ── Validate critical settings at import time ─────────────────────────────────
def validate() -> list[str]:
    """Return a list of configuration warnings (not errors – system still runs)."""
    warnings: list[str] = []
    if not GROQ_API_KEY:
        warnings.append(
            "GROQ_API_KEY is not set. Groq fallback will fail if triggered."
        )
    if not OLIST_DATA_DIR.exists():
        warnings.append(f"OLIST_DATA_DIR not found: {OLIST_DATA_DIR}")
    if not POLICY_DIR.exists():
        warnings.append(f"POLICY_DIR not found: {POLICY_DIR}")
    return warnings
