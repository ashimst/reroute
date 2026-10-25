"""
Hugging Face Spaces Native Gradio Entrypoint for REROUTE Engine.

Binds natively to port 7860 with 16 GB RAM, embedding all FastAPI routes into Gradio.
"""

from __future__ import annotations

# Hugging Face ZeroGPU requires 'spaces' to be imported before any CUDA/torch modules
try:
    import spaces  # pyright: ignore[reportMissingImports]
except ImportError:
    class spaces:  # type: ignore
        @staticmethod
        def GPU(fn=None, *args, **kwargs):
            if fn:
                return fn
            return lambda f: f

@spaces.GPU
def _zero_gpu_warmup():
    """Satisfies Hugging Face ZeroGPU startup AST scanner."""
    return True

_zero_gpu_warmup()

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

# 3. Mount Gradio interface onto the primary FastAPI engine
from app.main import app as fastapi_app

fastapi_app.state.run_case = _run_case
fastapi_app.state.loader = _loader
fastapi_app.state.repo = _repo
fastapi_app.state.graph = graph

app = gr.mount_gradio_app(fastapi_app, demo, path="/", ssr_mode=False)
log.info("Gradio UI mounted onto FastAPI parent engine at / (SSR disabled)")

# 4. Launch Uvicorn server on port 7860 (Hugging Face default)
if __name__ == "__main__":
    import uvicorn
    port = 7860
    log.info("Starting Uvicorn server on 0.0.0.0:%d …", port)
    uvicorn.run(app, host="0.0.0.0", port=port)

