"""
Hugging Face Spaces Native Gradio Entrypoint for REROUTE Engine.

Binds natively to port 7860 with 16 GB RAM, embedding all FastAPI routes into Gradio.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Set up paths so backend/ is in sys.path
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure data directories are resolved
os.environ.setdefault("OLIST_DATA_DIR", str(BACKEND_DIR / "data" / "olist"))
os.environ.setdefault("POLICY_DIR", str(BACKEND_DIR / "data" / "policies"))
os.environ.setdefault("VECTOR_STORE_PATH", str(BACKEND_DIR / "data" / "policy_index"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("reroute.server")

log.info("Starting REROUTE Intelligence Engine on Hugging Face Spaces…")

# 1. Warm up engine dependencies once at boot
from src.data import loader as _loader
from src.data import repository as _repo
from src.graph.workflow import build_compiled_graph, run_case as _run_case
from src.rag.policy_retriever import _ensure_loaded as _warm_rag

_loader.load_all()
log.info("Olist datasets loaded: %d orders ready", len(_loader.get_orders()))

_warm_rag()
log.info("Policy vector index ready")

graph = build_compiled_graph()
log.info("LangGraph state machine compiled successfully")

# 2. Build Gradio UI for Space visitors
import gradio as gr
from fastapi.middleware.cors import CORSMiddleware
from app.routers import analytics, auth, cases, cdn, chat, health, info, orders, workspaces

with gr.Blocks(title="REROUTE Exception Engine") as demo:
    gr.Markdown(
        """
        # ⚡ REROUTE — Intelligence Engine (API Backend)
        
        The dual-process cognitive exception resolution engine is **active and ready**.
        
        - **Frontend App**: [https://reroute.pages.dev](https://reroute.pages.dev)
        - **API Health Check**: [`/api/health`](/api/health)
        - **Interactive Swagger Docs**: [`/api/docs`](/api/docs)
        - **Hardware Specs**: 2 vCPU • **16 GB RAM** (SentenceTransformers + FAISS)
        """
    )
    with gr.Row():
        gr.Markdown(
            """
            ### Status: **Healthy & Running**
            Connect your frontend by configuring `VITE_API_URL` to this Space's URL.
            """
        )

# 3. Inject engine state and routers directly into demo.app (which is FastAPI/Starlette)
demo.app.state.run_case = _run_case
demo.app.state.loader = _loader
demo.app.state.repo = _repo
# ZeroGPU compatibility for Hugging Face Spaces (in case ZeroGPU hardware is selected)
try:
    import importlib
    _spaces = importlib.import_module("spaces")
    _spaces.GPU(lambda: True)()
    log.info("ZeroGPU compatibility hook registered")
except Exception:
    pass

demo.app.state.graph = graph

# Configure CORS for custom domain (reroute.noesisframeworks.com), Cloudflare Pages, and local dev
demo.app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://reroute.noesisframeworks.com",
        "http://reroute.noesisframeworks.com",
        "https://*.pages.dev",
        "http://localhost:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all application routers
demo.app.include_router(analytics.router)
demo.app.include_router(auth.router)
demo.app.include_router(cdn.router)
demo.app.include_router(cases.router)
demo.app.include_router(chat.router)
demo.app.include_router(orders.router)
demo.app.include_router(health.router)
demo.app.include_router(info.router)
demo.app.include_router(workspaces.router)

log.info("All API routers mounted onto Gradio app")

# 4. Launch Gradio natively on port 7860 (ssr_mode=False avoids running Node.js)
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    demo.launch(server_name="0.0.0.0", server_port=port, ssr_mode=False)
