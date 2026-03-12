"""
Email Microservice
==================
Combines two sub-services under one FastAPI app:

  1. Read Receipt  — track when recipients open an email
  2. Opt-Out       — one-click unsubscribe with sender|receiver suppression list

Environment variables
---------------------
  MICROSERVICE_DB_PATH    Path to the SQLite database  (default: ./email_microservice.db)
  MICROSERVICE_API_KEY    Master key for /admin/* routes  (default: your-super-secure-microservice-key)
  MICROSERVICE_PORT       Port to listen on              (default: 8001)
"""

import os
import secrets
from datetime import datetime
from typing import Annotated

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  dotenv not installed – using system env vars")

from database import DATABASE_NAME, get_db_connection, init_database
from email_read_router import router as read_router
from email_optout_router import router as optout_router

MICROSERVICE_API_KEY = os.getenv("MICROSERVICE_API_KEY", "your-super-secure-microservice-key")

print(f"🗄️  DATABASE = {DATABASE_NAME}")
print(f"🔑 API KEY  = {MICROSERVICE_API_KEY[:10]}...{MICROSERVICE_API_KEY[-5:]}")

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Email Microservice",
    description="Read-receipt tracking + opt-out / unsubscribe management",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Mount sub-routers
app.include_router(read_router)
app.include_router(optout_router)


# ── Admin auth ────────────────────────────────────────────────────────────────

def verify_microservice_api_key(x_api_key: Annotated[str, Header()]):
    if x_api_key != MICROSERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid master API key")
    return True


# ── Admin: backend management ─────────────────────────────────────────────────

class CreateBackendRequest(BaseModel):
    name: str


@app.post("/admin/create-backend", tags=["Admin"])
async def create_backend(
    request: CreateBackendRequest,
    _: bool = Depends(verify_microservice_api_key),
):
    """
    Create a new backend tenant and receive its API key.
    Requires the master MICROSERVICE_API_KEY in the X-Api-Key header.
    """
    backend_id = f"backend_{secrets.token_urlsafe(16)}"
    api_key = f"bk_{secrets.token_urlsafe(32)}"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO backends (backend_id, api_key, name) VALUES (?, ?, ?)",
            (backend_id, api_key, request.name),
        )
        conn.commit()

    return {
        "backend_id": backend_id,
        "api_key": api_key,
        "name": request.name,
        "created_at": datetime.utcnow().isoformat(),
    }


# ── Health & root ─────────────────────────────────────────────────────────────

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    print("hello")
    return FileResponse("./content/favicon.ico")


@app.get("/health", tags=["Meta"])
async def health_check():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM email_reads WHERE processed = FALSE AND read_at IS NOT NULL")
            unprocessed_reads = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM backends WHERE active = TRUE")
            active_backends = cursor.fetchone()[0]

        return {
            "status": "healthy",
            "database": "connected",
            "active_backends": active_backends,
            "unprocessed_reads": unprocessed_reads,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Health check failed: {exc}")


@app.get("/", tags=["Meta"])
async def root():
    return {
        "service": "Email Microservice",
        "version": "2.0.0",
        "modules": ["read-receipt", "optout"],
        "status": "running",
    }


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    init_database()


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("MICROSERVICE_PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)