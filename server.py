"""
Hugging Face Spaces Entrypoint for REROUTE Engine.

Runs FastAPI with LangGraph, FAISS, and Cactus Needle on 16 GB RAM with Gradio.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' and 'src' resolve directly
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure current working directory has access to backend/data
os.environ.setdefault("OLIST_DATA_DIR", str(BACKEND_DIR / "data" / "olist"))
os.environ.setdefault("POLICY_DIR", str(BACKEND_DIR / "data" / "policies"))
os.environ.setdefault("VECTOR_STORE_PATH", str(BACKEND_DIR / "data" / "policy_index"))

import gradio as gr
from app.main import app as fastapi_app

# Create a clean Gradio interface for anyone browsing the Space directly
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
            ### Status: **Healthy**
            Connect your frontend by configuring `VITE_API_URL` to this Space's URL.
            """
        )

# Mount Gradio onto the existing FastAPI app at /
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
