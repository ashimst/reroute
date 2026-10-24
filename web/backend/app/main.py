"""
REROUTE – FastAPI backend

Startup:
  1. Adds the reroute/ package to sys.path so imports like `from src.graph…` work.
  2. Pre-loads the Olist CSVs and policy vector index (slow on first boot; cached after).
  3. Wires the compiled graph's run_case() into app.state.

Run:
  cd web/backend
  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Path bootstrap — add reroute/ to sys.path ─────────────────────────────────
_REROUTE = Path(__file__).resolve().parents[3] / "reroute"
if str(_REROUTE) not in sys.path:
    sys.path.insert(0, str(_REROUTE))

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s  %(message)s",
)
log = logging.getLogger(__name__)


# ── Lifespan: warm up the engine once at startup ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("REROUTE API starting – warming up engine …")

    # Lazy imports after path is set
    from src.data import loader as _loader
    from src.data import repository as _repo
    from src.graph.workflow import build_compiled_graph
    from src.rag.policy_retriever import _ensure_loaded as _warm_rag

    # Load CSVs into module cache
    _loader.load_all()
    log.info("Olist data loaded: %d orders", len(_loader.get_orders()))

    # Build FAISS index (skips if cache exists)
    _warm_rag()
    log.info("Policy index ready")

    # Compile LangGraph graph once and reuse
    graph = build_compiled_graph()

    from src.graph.workflow import run_case as _run_case
    app.state.run_case = _run_case
    app.state.loader = _loader
    app.state.repo = _repo
    app.state.graph = graph

    log.info("REROUTE API ready")
    yield
    log.info("REROUTE API shutting down")


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="REROUTE",
    description=(
        "Retail Flow Exception Routing and Resolution Engine. "
        "Routes customer order exceptions through a LangGraph state machine, "
        "retrieves relevant policies via semantic search, executes deterministic "
        "tools via Cactus Needle, and falls back to Groq LLM when necessary."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS — allow the Vite dev server and same-origin prod ────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # open for local dev; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
from app.routers import cases, chat, health, orders  # noqa: E402

app.include_router(cases.router)
app.include_router(chat.router)
app.include_router(orders.router)
app.include_router(health.router)


# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )
