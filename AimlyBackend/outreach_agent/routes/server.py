"""
Server Health and Status Routes
Provides basic health checks and server information
"""
import os
import requests
from datetime import datetime, timezone
from fastapi import APIRouter
from core.database.connection import get_connection

server_router = APIRouter(tags=["Server"])


# ==================================================================================
# GET /health - Check server health status
# ==================================================================================
@server_router.get("/health/")
def health_check():
    """
    Check the server health status.
    Returns basic info like uptime, database connectivity, and service availability.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "unknown",
        "services": {
            "api": "operational",
            "database": "unknown",
            "auth": "operational",
            "optout": "unknown"
        }
    }

    # ── Database ──────────────────────────────────────────────────────────────
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
        if result:
            health_status["database"] = "connected"
            health_status["services"]["database"] = "operational"
        else:
            health_status["database"] = "error"
            health_status["services"]["database"] = "error"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["services"]["database"] = "error"
        health_status["status"] = "unhealthy"

    # ── Opt-out microservice ──────────────────────────────────────────────────
    base_url = os.getenv("MICROSERVICE_BASE_URL")
    api_key  = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not api_key:
        health_status["services"]["optout"] = "not configured"
    else:
        try:
            resp = requests.get(
                f"{base_url}/health/",
                headers={"X-Api-Key": api_key},
                timeout=5,
            )
            if resp.status_code == 200:
                health_status["services"]["optout"] = "operational"
            else:
                health_status["services"]["optout"] = f"error: HTTP {resp.status_code}"
                health_status["status"] = "degraded"
        except Exception as e:
            health_status["services"]["optout"] = f"error: {str(e)}"
            health_status["status"] = "degraded"

    if health_status["status"] in ("degraded", "unhealthy"):
        from fastapi import Response
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=health_status)

    return health_status