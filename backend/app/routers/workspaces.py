"""
Workspaces, Custom Policy Ingestion, and BYOK Management Router.
Allows users to switch between the default Online Demo (Olist 99.4k) and custom store workspaces.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from app.routers.auth import require_authenticated_user, get_current_user_optional
from src.llm.provider_factory import LLMProviderFactory

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

_WORKSPACE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "workspaces"
_WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
_CONFIG_FILE = _WORKSPACE_DIR / "workspace_config.json"

class WorkspaceConfig(BaseModel):
    workspace_id: str = "custom_store"
    workspace_name: str = "My Custom Store"
    active_mode: str = "demo"  # 'demo' | 'custom'
    llm_provider: str = "groq"  # 'groq' | 'openai' | 'anthropic' | 'ollama'
    llm_model: str = "llama-3.3-70b-versatile"
    llm_api_key: Optional[str] = ""
    s1_confidence_threshold: float = 0.50
    order_adapter: str = "demo_olist"  # 'demo_olist' | 'shopify' | 'webhook'
    webhook_url: Optional[str] = ""
    public_key: str = "pk_live_rf_demo_88a92f10"
    secret_key: str = "sk_live_rf_demo_9f2c81a8"

class PolicyIngestRequest(BaseModel):
    title: str
    content: str
    category: str = "general"  # 'returns' | 'delivery' | 'billing' | 'general'

def _load_config() -> WorkspaceConfig:
    if _CONFIG_FILE.exists():
        try:
            data = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            return WorkspaceConfig(**data)
        except Exception as e:
            log.warning(f"Failed to load workspace config: {e}")
    # Default config
    cfg = WorkspaceConfig()
    _save_config(cfg)
    return cfg

def _save_config(cfg: WorkspaceConfig):
    try:
        _CONFIG_FILE.write_text(json.dumps(cfg.model_dump(), indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Failed to save workspace config: {e}")

@router.get("/current")
async def get_current_workspace(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Returns the current workspace status, active mode, policy statistics, and user account/tier if authenticated."""
    cfg = _load_config()
    
    # Count custom policies if any
    custom_policies_dir = _WORKSPACE_DIR / "policies"
    custom_policies_dir.mkdir(parents=True, exist_ok=True)
    custom_files = list(custom_policies_dir.glob("*.json"))
    
    policies_list = []
    total_chunks = 0
    for f in custom_files:
        try:
            p_data = json.loads(f.read_text(encoding="utf-8"))
            policies_list.append(p_data)
            total_chunks += len(p_data.get("chunks", []))
        except Exception:
            pass

    return {
        "config": {
            **cfg.model_dump(),
            # Mask API key for security
            "llm_api_key": f"{cfg.llm_api_key[:4]}...{cfg.llm_api_key[-4:]}" if cfg.llm_api_key and len(cfg.llm_api_key) > 8 else ("configured" if cfg.llm_api_key else "")
        },
        "has_custom_key": bool(cfg.llm_api_key and cfg.llm_api_key.strip()),
        "custom_policies_count": len(policies_list),
        "custom_chunks_count": total_chunks,
        "default_demo_policies_count": 74,
        "default_demo_orders_count": 99441,
        "authenticated": user is not None,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "company": user.get("company", "Store"),
            "plan": user.get("plan", "free"),
            "usage_count": user.get("usage_count", 0),
            "quota_limit": user.get("quota_limit", 5),
            "remaining_quota": max(0, (user.get("quota_limit", 5) if user.get("plan") == "free" else 999999) - user.get("usage_count", 0)),
            "is_paid": user.get("plan") == "pro",
        } if user else None,
    }

@router.post("/config")
async def update_workspace_config(
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Update workspace provider, model, API keys, and order source (Authenticated)."""
    cfg = _load_config()
    
    if "workspace_name" in payload:
        cfg.workspace_name = str(payload["workspace_name"])
    if "active_mode" in payload:
        cfg.active_mode = "custom" if payload["active_mode"] == "custom" else "demo"
    if "llm_provider" in payload:
        cfg.llm_provider = str(payload["llm_provider"]).lower()
    if "llm_model" in payload:
        cfg.llm_model = str(payload["llm_model"])
    if "llm_api_key" in payload and payload["llm_api_key"] is not None:
        key_val = str(payload["llm_api_key"]).strip()
        if key_val and not key_val.endswith("..."):
            cfg.llm_api_key = key_val
    if "s1_confidence_threshold" in payload:
        cfg.s1_confidence_threshold = float(payload["s1_confidence_threshold"])
    if "order_adapter" in payload:
        cfg.order_adapter = str(payload["order_adapter"])
    if "webhook_url" in payload:
        cfg.webhook_url = str(payload["webhook_url"])

    # Ensure keys exist
    if not cfg.public_key or cfg.public_key.startswith("pk_live_rf_demo"):
        cfg.public_key = f"pk_live_{uuid.uuid4().hex[:16]}"
    if not cfg.secret_key or cfg.secret_key.startswith("sk_live_rf_demo"):
        cfg.secret_key = f"sk_live_{uuid.uuid4().hex[:24]}"

    _save_config(cfg)
    return {"status": "success", "config": cfg.model_dump(exclude={"llm_api_key"})}

@router.post("/policies/upload")
async def upload_custom_policy(
    payload: PolicyIngestRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """
    Ingest, parse, and chunk custom corporate policy documents.
    Generates rule chunks with IDs and metadata (Authenticated).
    """
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Policy content cannot be empty")

    custom_policies_dir = _WORKSPACE_DIR / "policies"
    custom_policies_dir.mkdir(parents=True, exist_ok=True)

    # Chunking logic: split on headers, rule markers or double newlines
    raw_lines = payload.content.splitlines()
    chunks = []
    current_chunk = []
    chunk_index = 1
    
    cat_code = payload.category[:3].upper() if payload.category else "POL"

    for line in raw_lines:
        line_s = line.strip()
        if not line_s:
            if current_chunk:
                rule_text = "\n".join(current_chunk).strip()
                if len(rule_text) > 15:
                    rule_id = f"{cat_code}-{chunk_index:02d}"
                    chunks.append({"id": rule_id, "text": rule_text, "category": payload.category})
                    chunk_index += 1
                current_chunk = []
            continue
        current_chunk.append(line_s)
    
    if current_chunk:
        rule_text = "\n".join(current_chunk).strip()
        if len(rule_text) > 15:
            rule_id = f"{cat_code}-{chunk_index:02d}"
            chunks.append({"id": rule_id, "text": rule_text, "category": payload.category})

    # If document had no blank lines, create at least 1 chunk
    if not chunks and payload.content.strip():
        chunks.append({
            "id": f"{cat_code}-01",
            "text": payload.content.strip()[:1000],
            "category": payload.category,
        })

    policy_id = f"pol_{uuid.uuid4().hex[:8]}"
    doc_record = {
        "policy_id": policy_id,
        "title": payload.title or "Custom Store Policy",
        "category": payload.category,
        "created_at": time.time(),
        "chunks": chunks,
        "raw_length": len(payload.content),
    }

    out_file = custom_policies_dir / f"{policy_id}.json"
    out_file.write_text(json.dumps(doc_record, indent=2), encoding="utf-8")

    return {
        "status": "success",
        "policy_id": policy_id,
        "title": doc_record["title"],
        "chunks_created": len(chunks),
        "sample_chunk": chunks[0] if chunks else None,
    }

@router.get("/policies")
async def list_custom_policies():
    """Lists all custom policies uploaded to the active workspace."""
    custom_policies_dir = _WORKSPACE_DIR / "policies"
    custom_policies_dir.mkdir(parents=True, exist_ok=True)
    custom_files = list(custom_policies_dir.glob("*.json"))
    
    result = []
    for f in custom_files:
        try:
            result.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    return {"policies": result}

@router.delete("/policies/{policy_id}")
async def delete_custom_policy(
    policy_id: str,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Delete a custom policy from the workspace (Authenticated)."""
    p_file = _WORKSPACE_DIR / "policies" / f"{policy_id}.json"
    if p_file.exists():
        p_file.unlink()
        return {"status": "deleted", "policy_id": policy_id}
    raise HTTPException(status_code=404, detail="Policy not found")

@router.post("/test-connection")
async def test_llm_connection(
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Test API key and model connectivity for the chosen provider (Authenticated)."""
    provider = payload.get("provider", "groq")
    api_key = payload.get("api_key")
    model = payload.get("model")

    cfg = _load_config()
    key_to_use = api_key or cfg.llm_api_key

    t0 = time.time()
    try:
        resp = await LLMProviderFactory.generate_completion(
            messages=[
                {"role": "system", "content": "You are a test ping agent. Answer in 5 words."},
                {"role": "user", "content": "Respond with 'Retail Flow connected successfully.'"}
            ],
            provider=provider,
            api_key=key_to_use,
            model=model,
            max_tokens=20,
        )
        latency = int((time.time() - t0) * 1000)
        return {
            "status": "connected",
            "latency_ms": latency,
            "provider": resp.get("provider"),
            "model": resp.get("model"),
            "reply": resp.get("content", "").strip(),
        }
    except Exception as e:
        log.warning(f"LLM connection test failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "latency_ms": int((time.time() - t0) * 1000),
        }
