"""
Email Microservice
==================
Combines two sub-services under one FastAPI app:

  1. Read Receipt  — track when recipients open an email
  2. Opt-Out       — one-click unsubscribe with sender|receiver suppression list

Environment variables
---------------------
  MICROSERVICE_API_KEY    Shared key for all routes
  MICROSERVICE_PORT       Port to listen on (default: 8001)
  DB_HOST / DB_PORT / MICROSERVICE_DB_USER / MICROSERVICE_DB_PASSWORD / MICROSERVICE_DB_NAME

NOTE: Schema is pre-created by AimlyDatabase during `make init-db`.
"""

import os
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  dotenv not installed – using system env vars")

from database import get_db_connection
from email_read_router import router as read_router
from email_optout_router import router as optout_router

MICROSERVICE_API_KEY = os.getenv("MICROSERVICE_API_KEY", "your-super-secure-microservice-key")
print(f"🔑 API KEY = {MICROSERVICE_API_KEY[:10]}...{MICROSERVICE_API_KEY[-5:]}")

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Email Microservice",
    description="Read-receipt tracking + opt-out / unsubscribe management",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(read_router)
app.include_router(optout_router)


# ── Health & root ─────────────────────────────────────────────────────────────

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("./content/favicon.ico")


@app.get("/health", tags=["Meta"])
async def health_check():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT COUNT(*) as cnt FROM email_reads WHERE processed = 0 AND read_at IS NOT NULL"
                )
                unprocessed_reads = cursor.fetchone()["cnt"]

        return {
            "status":            "healthy",
            "database":          "connected",
            "unprocessed_reads": unprocessed_reads,
            "timestamp":         datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Health check failed: {exc}")


@app.get("/", tags=["Meta"])
async def root():
    return {
        "service": "Email Microservice",
        "version": "3.0.0",
        "modules": ["read-receipt", "optout"],
        "status":  "running",
    }


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("MICROSERVICE_PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)