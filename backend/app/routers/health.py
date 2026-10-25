"""GET /api/health — liveness + readiness check."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.case import HealthResponse

router = APIRouter(tags=["meta"])


@router.get("/api/health", response_model=HealthResponse, summary="Health check")
def health(request: Request):
    app_state = request.app.state
    from src.data import loader as _loader
    loader = getattr(app_state, "loader", None) or _loader

    orders_loaded = 0
    engine_ready = False

    try:
        if loader:
            df = loader.get_orders()
            orders_loaded = len(df)
            engine_ready = orders_loaded > 0
    except Exception:
        pass


    from src.config import validate
    warnings = validate()

    return HealthResponse(
        status="ok" if engine_ready else "degraded",
        engine_ready=engine_ready,
        olist_orders_loaded=orders_loaded,
        warnings=warnings,
    )
