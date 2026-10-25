"""
Policy RAG – load, chunk, embed, and retrieve policy documents.

Architecture:
  1. Load the four .md policy files from POLICY_DIR.
  2. Split them into per-rule chunks (one chunk per bold policy ID line).
  3. Embed with sentence-transformers (all-MiniLM-L6-v2, ~80 MB, CPU-friendly).
  4. Store in a FAISS flat index for cosine similarity search.
  5. Cache the index to VECTOR_STORE_PATH so subsequent runs skip re-embedding.

The retriever NEVER invents policy rules – it only returns text from the files.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional, cast

if TYPE_CHECKING:
    import faiss

import numpy as np

from src.config import POLICY_DIR, VECTOR_STORE_PATH

log = logging.getLogger(__name__)

# ── Lazy imports (heavy deps loaded only when retriever is first used) ─────────
_embedder: Any = None
_index: Any = None
_chunks: list[dict] = []   # [{id, text, source_file, full_text}]


# ── 1. Loading and chunking ───────────────────────────────────────────────────

# Pattern matches lines like:  **RET-03** Some rule text
# or **DEL-11** ...
_RULE_PATTERN = re.compile(
    r"\*\*([A-Z]{2,5}-\d{1,3}[A-Z]?)\*\*\s*(.*)",
    re.DOTALL,
)


def _chunk_policy_file(path: Path) -> list[dict]:
    """
    Split one policy .md file into per-rule chunks.

    Each chunk:
        {
            "id":          "RET-03",
            "text":        "RET-03: Damaged items reported within 30 days …",
            "source_file": "returns.md",
        }
    """
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    chunks = []

    for line in lines:
        m = _RULE_PATTERN.search(line)
        if m:
            rule_id = m.group(1)
            rule_text = re.sub(r"\*\*[A-Z]{2,5}-\d{1,3}[A-Z]?\*\*\s*", "", line).strip()
            chunks.append(
                {
                    "id": rule_id,
                    "text": f"{rule_id}: {rule_text}",
                    "source_file": path.name,
                }
            )

    log.debug("Chunked %s → %d rules", path.name, len(chunks))
    return chunks


def _load_all_chunks() -> list[dict]:
    policy_dir = Path(POLICY_DIR)
    all_chunks: list[dict] = []
    for fname in ("returns.md", "refunds.md", "delivery.md", "payments.md"):
        fpath = policy_dir / fname
        if not fpath.exists():
            log.warning("Policy file not found: %s", fpath)
            continue
        all_chunks.extend(_chunk_policy_file(fpath))
    log.info("Total policy chunks loaded: %d", len(all_chunks))
    return all_chunks


# ── 2. Embedding ──────────────────────────────────────────────────────────────

def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        log.info("Loading sentence-transformer model (first run may take a moment)…")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def _embed(texts: list[str]) -> np.ndarray:
    model = _get_embedder()
    return model.encode(texts, normalize_embeddings=True, show_progress_bar=False)


# ── 3. FAISS index ────────────────────────────────────────────────────────────

_INDEX_FILE = "faiss.index"
_CHUNKS_FILE = "chunks.json"


def _save_index(index, chunks: list[dict], store_path: Path) -> None:
    import faiss
    store_path.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(store_path / _INDEX_FILE))
    (store_path / _CHUNKS_FILE).write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    log.info("Policy index saved to %s", store_path)


def _load_index(store_path: Path):
    import faiss
    index = faiss.read_index(str(store_path / _INDEX_FILE))
    chunks = json.loads((store_path / _CHUNKS_FILE).read_text(encoding="utf-8"))
    log.info("Policy index loaded from cache (%d chunks).", len(chunks))
    return index, chunks


def _build_index(chunks: list[dict]):
    import faiss
    texts = [c["text"] for c in chunks]
    embeddings = _embed(texts).astype(np.float32)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)   # inner-product on normalised vecs = cosine
    cast(Any, index).add(embeddings)
    return index


# ── 4. Public initialise / retrieve ──────────────────────────────────────────

def _ensure_loaded() -> None:
    global _index, _chunks
    if _index is not None:
        return  # already initialised

    store_path = Path(VECTOR_STORE_PATH)
    index_file = store_path / _INDEX_FILE
    chunks_file = store_path / _CHUNKS_FILE

    if index_file.exists() and chunks_file.exists():
        _index, _chunks = _load_index(store_path)
    else:
        log.info("Building policy vector index from scratch…")
        _chunks = _load_all_chunks()
        if not _chunks:
            raise RuntimeError(
                f"No policy chunks found in {POLICY_DIR}. "
                "Check that policy .md files exist."
            )
        _index = _build_index(_chunks)
        _save_index(_index, _chunks, store_path)


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve the top-k most relevant policy chunks for a query.

    Returns a list of dicts:
        [
            {
                "policy_id":    "RET-03",
                "policy_text":  "RET-03: Damaged items reported within …",
                "source_file":  "returns.md",
                "score":        0.87,          # cosine similarity 0..1
            },
            …
        ]

    The retriever never invents rules – every result comes verbatim from the
    policy files loaded at startup.
    """
    _ensure_loaded()
    if _index is None:
        raise RuntimeError("Policy vector index failed to initialize or load.")

    query_vec = _embed([query]).astype(np.float32)
    scores, indices = _index.search(query_vec, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(_chunks):
            continue
        chunk = _chunks[idx]
        results.append(
            {
                "policy_id": chunk["id"],
                "policy_text": chunk["text"],
                "source_file": chunk["source_file"],
                "score": round(float(score), 4),
            }
        )
    return results


def retrieve_for_route(route: str, query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve policy chunks filtered to the relevant policy file for a route.

    route: "returns" | "delivery" | "payment"

    Falls back to unfiltered retrieve if no route-specific chunks match.
    """
    _ensure_loaded()

    route_to_files = {
        "returns":  {"returns.md", "refunds.md"},
        "delivery": {"delivery.md", "refunds.md"},
        "payment":  {"payments.md", "refunds.md"},
    }
    relevant_files = route_to_files.get(route.lower(), set())

    # First try semantic search unrestricted, then filter by file
    candidates = retrieve(query, top_k=top_k * 3)
    filtered = [c for c in candidates if c["source_file"] in relevant_files]

    if filtered:
        return filtered[:top_k]

    # Fallback: return unfiltered results
    log.debug("No route-filtered results for '%s'; returning unfiltered.", route)
    return candidates[:top_k]


def format_policies_for_prompt(policies: list[dict]) -> str:
    """Return a compact string representation for use in LLM prompts."""
    if not policies:
        return "No relevant policies found."
    lines = []
    for p in policies:
        lines.append(f"[{p['policy_id']}] {p['policy_text']}  (score={p['score']:.2f})")
    return "\n".join(lines)
