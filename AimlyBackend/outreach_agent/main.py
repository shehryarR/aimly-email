import os
import asyncio
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Database and core
from core.database.connection import create_tables, load_env_json, reset_company_addition_flags

# Schedulers and workers
from scheduler import email_scheduler
from company_adder_worker import company_adder_worker
from sync_microservice import run_sync_microservice

# Routes
from routes import (
    server_router,
    auth_router,
    user_router,
    user_keys_router,
    global_settings_router,
    company_router,
    campaign_router,
    campaign_company_router,
    campaign_preferences_router,
    email_router,
    email_actions_router,
    stats_router,
    category_router,
    category_company_router,
    get_current_user
)

# Attachment routers
from routes.attachment import attachment_router
from routes.attachment_management import attachment_manager_router

# ── Environment ───────────────────────────────────────────────────────────────

load_env_json()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8000")
ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    print("🚀 AI Email Outreach Pro API v2.0.0 starting up...")
    print(f"📎 Attachment storage path: {ATTACHMENT_STORAGE_PATH}")

    # Initialize database
    create_tables()

    # Reset any stuck company addition flags from previous crashes
    reset_company_addition_flags()

    # Start background services
    email_scheduler.start()           # Handles scheduled emails
    company_adder_worker.start()      # Handles AI company discovery jobs

    # Start sync microservice
    sync_task = asyncio.create_task(run_sync_microservice())

    print("✅ Database initialised")
    print("✅ Company addition flags reset")
    print("✅ Email scheduler started")
    print("✅ Company adder worker started")
    print(f"✅ Sync background task running (CORS origin: {FRONTEND_URL})")

    yield

    # SHUTDOWN
    print("🛑 Shutting down...")

    # Cancel sync task
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        print("  Sync task safely cancelled.")

    # Stop schedulers and workers
    try:
        email_scheduler.stop()
        print("  Email scheduler stopped.")
    except Exception as exc:
        print(f"  Warning during email scheduler shutdown: {exc}")

    try:
        company_adder_worker.stop()
        print("  Company adder worker stopped.")
    except Exception as exc:
        print(f"  Warning during company adder worker shutdown: {exc}")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Email Outreach Pro API",
    description="REST API for managing AI-powered email outreach campaigns",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=False
)


# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(server_router)                              # /health
app.include_router(auth_router)                                # /auth/*
app.include_router(user_router)                                # /user/*
app.include_router(user_keys_router)                           # /user_keys/*
app.include_router(global_settings_router)                     # /global_setting/*
app.include_router(company_router)                             # /company/*
app.include_router(campaign_router)                            # /campaign/*
app.include_router(campaign_company_router)                    # /campaign/{id}/company/*
app.include_router(campaign_preferences_router)                # /campaign/{id}/campaign_preference/*
app.include_router(email_router)                               # /email/* (CRUD: fetch, update, delete)
app.include_router(email_actions_router)                       # /email/* (actions: generate, send, draft)
app.include_router(stats_router)                               # /stats/*
app.include_router(attachment_router)                          # /attachment/*
app.include_router(attachment_manager_router)                  # /email/{id}/attachments, etc.
app.include_router(category_router)                            # /category/*
app.include_router(category_company_router)                    # /category/{id}/company/*


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)},
    )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("APP_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)