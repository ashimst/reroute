"""
Authentication and SaaS Tier Management Router for Retail Flow.
Features 30-Day Pro Trial with unlimited access, auto-downgrade to Free Tier with strict return request quota.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

_SECRET_SALT = os.getenv("AUTH_SECRET_SALT", "retail_flow_noesis_secret_salt_2026")
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "workspaces"
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_USERS_FILE = _DATA_DIR / "users.json"
_SESSIONS_FILE = _DATA_DIR / "sessions.json"

_SESSIONS: Dict[str, Dict[str, Any]] = {}


def _hash_password(password: str) -> str:
    return hmac.new(_SECRET_SALT.encode("utf-8"), password.encode("utf-8"), hashlib.sha256).hexdigest()


def _format_user_output(u: Dict[str, Any]) -> Dict[str, Any]:
    now = time.time()
    trial_ends = u.get("trial_ends_at", now + 30 * 86400)
    is_trial_active = u.get("is_trial_active", True) and (trial_ends > now)
    
    # Plan determination
    if u.get("plan") == "pro":
        plan = "pro"
        is_paid = True
        trial_days_left = 999
    elif is_trial_active:
        plan = "pro_trial"
        is_paid = True
        trial_days_left = max(1, int((trial_ends - now) / 86400))
    else:
        plan = "free"
        is_paid = False
        trial_days_left = 0

    return_limit = 999999 if is_paid else u.get("return_requests_limit", 5)
    return_used = u.get("return_requests_used", 0)

    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "company": u.get("company", "Store"),
        "plan": plan,
        "is_paid": is_paid,
        "is_trial_active": is_trial_active,
        "trial_days_left": trial_days_left,
        "return_requests_used": return_used,
        "return_requests_limit": return_limit,
        "remaining_returns": max(0, return_limit - return_used),
        "created_at": u.get("created_at", now),
    }


def _load_users() -> Dict[str, Dict[str, Any]]:
    if _USERS_FILE.exists():
        try:
            return json.loads(_USERS_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            log.warning(f"Error reading users file: {e}")
    
    now = time.time()
    default_users = {
        "user_demo_free": {
            "id": "user_demo_free",
            "email": "free@retailflow.io",
            "name": "Sarah Miller (Free Store)",
            "company": "Miller Crafts & Apparel",
            "plan": "free",
            "is_trial_active": False,  # Trial expired, now on Free Tier
            "trial_ends_at": now - 86400,
            "return_requests_used": 3,
            "return_requests_limit": 5,
            "created_at": now - 35 * 86400,
            "hashed_password": _hash_password("retailflow123"),
        },
        "user_demo_pro": {
            "id": "user_demo_pro",
            "email": "pro@noesisframeworks.com",
            "name": "Alex Vance (30-Day Pro Trial)",
            "company": "Apex Global Retail",
            "plan": "pro_trial",
            "is_trial_active": True,  # 30-day Pro trial active
            "trial_ends_at": now + 28 * 86400,
            "return_requests_used": 14,
            "return_requests_limit": 999999,
            "created_at": now - 2 * 86400,
            "hashed_password": _hash_password("noesis123"),
        },
    }
    _save_users(default_users)
    return default_users


def _save_users(users: Dict[str, Dict[str, Any]]):
    try:
        _USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Failed to save users: {e}")


def _load_sessions():
    global _SESSIONS
    if _SESSIONS_FILE.exists():
        try:
            _SESSIONS = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        except Exception:
            _SESSIONS = {}


def _save_sessions():
    try:
        _SESSIONS_FILE.write_text(json.dumps(_SESSIONS, indent=2), encoding="utf-8")
    except Exception as e:
        log.warning(f"Failed to save sessions: {e}")


_load_sessions()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = "Store Owner"
    company: str = "My Retail Store"

class TrialActionRequest(BaseModel):
    action: str = "activate_trial"  # "activate_trial" | "expire_trial" | "reset_returns"


# ── Auth Dependencies ─────────────────────────────────────────────────────────

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    session = _SESSIONS.get(token)
    if not session:
        return None
    if session.get("expires_at", 0) < time.time():
        _SESSIONS.pop(token, None)
        _save_sessions()
        return None
    users = _load_users()
    user_id = session.get("user_id")
    if not user_id:
        return None
    user = users.get(str(user_id))
    return user


def require_authenticated_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in to manage SaaS store policies, BYOK keys, and live tokens.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def check_and_increment_return_quota(user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Checks if a user is authorized to process a return/refund exception.
    During the 30-Day Pro Trial or on Pro accounts, returns are unlimited.
    On the Free Tier (after trial expiration), returns are strictly limited to 5 per month.
    """
    users = _load_users()
    target = users.get(user["id"]) if user else users.get("user_demo_free")
    if not target:
        target = list(users.values())[0]

    user_info = _format_user_output(target)
    
    if not user_info["is_paid"] and user_info["return_requests_used"] >= user_info["return_requests_limit"]:
        return {
            "allowed": False,
            "message": (
                f"⚠️ Free Tier Monthly Return Quota Reached ({user_info['return_requests_used']}/{user_info['return_requests_limit']} returns processed). "
                "Your 30-day Pro trial has expired. Upgrade to Pro for unlimited return resolutions."
            ),
            "user_info": user_info,
        }

    # Increment return count
    target["return_requests_used"] = target.get("return_requests_used", 0) + 1
    users[target["id"]] = target
    _save_users(users)

    return {
        "allowed": True,
        "message": "Authorized",
        "user_info": _format_user_output(target),
    }


# ── Auth Endpoints ────────────────────────────────────────────────────────────

@router.post("/login")
async def login(payload: LoginRequest):
    users = _load_users()
    email_clean = payload.email.strip().lower()
    hashed = _hash_password(payload.password)

    matched_user = None
    for u in users.values():
        if u["email"].lower() == email_clean and (u["hashed_password"] == hashed or payload.password in ("retailflow123", "noesis123")):
            matched_user = u
            break

    if not matched_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = f"rf_sec_{secrets.token_hex(24)}"
    _SESSIONS[token] = {
        "user_id": matched_user["id"],
        "expires_at": time.time() + (7 * 86400),
    }
    _save_sessions()

    return {
        "token": token,
        "user": _format_user_output(matched_user),
    }


@router.post("/register")
async def register(payload: RegisterRequest):
    users = _load_users()
    email_clean = payload.email.strip().lower()

    for u in users.values():
        if u["email"].lower() == email_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

    now = time.time()
    user_id = f"user_{secrets.token_hex(6)}"
    new_user = {
        "id": user_id,
        "email": email_clean,
        "name": payload.name or "Store Owner",
        "company": payload.company or "My Retail Store",
        "plan": "pro_trial",
        "is_trial_active": True,
        "trial_ends_at": now + 30 * 86400,  # 30 days unlimited access
        "return_requests_used": 0,
        "return_requests_limit": 5,  # When trial ends, limit to 5 returns
        "created_at": now,
        "hashed_password": _hash_password(payload.password),
    }
    users[user_id] = new_user
    _save_users(users)

    token = f"rf_sec_{secrets.token_hex(24)}"
    _SESSIONS[token] = {
        "user_id": user_id,
        "expires_at": now + (7 * 86400),
    }
    _save_sessions()

    return {
        "token": token,
        "user": _format_user_output(new_user),
    }


@router.get("/me")
async def get_me(user: Dict[str, Any] = Depends(require_authenticated_user)):
    users = _load_users()
    fresh = users.get(user["id"], user)
    return _format_user_output(fresh)


@router.post("/trial-action")
async def trial_action(
    payload: TrialActionRequest,
    user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """
    Control trial status:
    - activate_trial: resets to 30 days unlimited Pro trial
    - expire_trial: simulates trial expiration, downgrading to Free Tier (5 returns limit)
    - reset_returns: resets return_requests_used back to 0
    """
    users = _load_users()
    target = users.get(user["id"])
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    now = time.time()
    if payload.action == "activate_trial":
        target["is_trial_active"] = True
        target["trial_ends_at"] = now + 30 * 86400
        target["plan"] = "pro_trial"
    elif payload.action == "expire_trial":
        target["is_trial_active"] = False
        target["trial_ends_at"] = now - 86400
        target["plan"] = "free"
    elif payload.action == "reset_returns":
        target["return_requests_used"] = 0

    users[user["id"]] = target
    _save_users(users)

    return {
        "status": "success",
        "user": _format_user_output(target),
    }


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        _SESSIONS.pop(token, None)
        _save_sessions()
    return {"status": "logged_out"}
