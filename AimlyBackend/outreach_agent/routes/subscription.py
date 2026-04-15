"""
Subscription Routes — Paddle Billing Integration
Handles subscription status checks and Paddle webhook events.

Endpoints:
  GET  /subscription/status   — returns current user's subscription status
  POST /subscription/webhook  — receives and processes Paddle webhook events
"""

import os
import hmac
import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from core.database.connection import get_connection
from routes.auth import get_current_user

subscription_router = APIRouter(prefix="/subscription", tags=["subscription"])

# ── Paddle config ─────────────────────────────────────────────────────────────
PADDLE_WEBHOOK_SECRET = os.getenv("PADDLE_WEBHOOK_SECRET", "")
ACTIVE_STATUSES = {"trialing", "active"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_subscription_by_user(user_id: int) -> dict | None:
    """Fetch subscription row for a given user_id."""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM subscriptions WHERE user_id = %s",
                (user_id,)
            )
            return cursor.fetchone()


def get_subscription_by_paddle_id(paddle_subscription_id: str) -> dict | None:
    """Fetch subscription row by Paddle subscription ID."""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM subscriptions WHERE paddle_subscription_id = %s",
                (paddle_subscription_id,)
            )
            return cursor.fetchone()


def upsert_subscription(user_id: int, data: dict):
    """Insert or update a subscription row."""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO subscriptions
                    (user_id, paddle_subscription_id, paddle_customer_id,
                     status, price_id, next_billed_at, current_period_ends_at, scheduled_change)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    paddle_subscription_id  = VALUES(paddle_subscription_id),
                    paddle_customer_id      = VALUES(paddle_customer_id),
                    status                  = VALUES(status),
                    price_id                = VALUES(price_id),
                    next_billed_at          = VALUES(next_billed_at),
                    current_period_ends_at  = VALUES(current_period_ends_at),
                    scheduled_change        = VALUES(scheduled_change),
                    updated_at              = CURRENT_TIMESTAMP
            """, (
                user_id,
                data.get("paddle_subscription_id"),
                data.get("paddle_customer_id"),
                data.get("status", "inactive"),
                data.get("price_id"),
                data.get("next_billed_at"),
                data.get("current_period_ends_at"),
                json.dumps(data.get("scheduled_change")) if data.get("scheduled_change") else None,
            ))
        conn.commit()


def update_subscription_by_paddle_id(paddle_subscription_id: str, data: dict):
    """Update an existing subscription row by Paddle subscription ID."""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE subscriptions
                SET status                 = %s,
                    next_billed_at         = %s,
                    current_period_ends_at = %s,
                    scheduled_change       = %s,
                    updated_at             = CURRENT_TIMESTAMP
                WHERE paddle_subscription_id = %s
            """, (
                data.get("status"),
                data.get("next_billed_at"),
                data.get("current_period_ends_at"),
                json.dumps(data.get("scheduled_change")) if data.get("scheduled_change") else None,
                paddle_subscription_id,
            ))
        conn.commit()


def verify_paddle_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify Paddle webhook signature.
    Paddle sends: Paddle-Signature: ts=<timestamp>;h1=<hmac_hash>
    """
    if not PADDLE_WEBHOOK_SECRET:
        print("Warning: PADDLE_WEBHOOK_SECRET not set — skipping signature verification")
        return True

    try:
        parts = dict(p.split("=", 1) for p in signature_header.split(";"))
        ts = parts.get("ts", "")
        h1 = parts.get("h1", "")

        signed_payload = f"{ts}:{raw_body.decode('utf-8')}"
        expected = hmac.new(
            PADDLE_WEBHOOK_SECRET.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected, h1)
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False


def parse_datetime(value: str | None) -> datetime | None:
    """Parse ISO datetime string from Paddle into Python datetime."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


# ── Routes ────────────────────────────────────────────────────────────────────

@subscription_router.get("/status")
def get_subscription_status(request: Request):
    """
    Returns the current user's subscription status.
    Called by the frontend on every page load to decide whether to show the paywall.
    """
    user = get_current_user(request)
    user_id = user["user_id"]

    subscription = get_subscription_by_user(user_id)

    if not subscription:
        return {
            "status": "inactive",
            "has_access": False,
        }

    status = subscription.get("status", "inactive")
    return {
        "status": status,
        "has_access": status in ACTIVE_STATUSES,
        "next_billed_at": subscription.get("next_billed_at"),
        "current_period_ends_at": subscription.get("current_period_ends_at"),
    }


@subscription_router.post("/webhook")
async def paddle_webhook(request: Request):
    """
    Receives Paddle webhook events and updates subscription status in DB.
    No JWT auth — verified by Paddle signature instead.
    """
    raw_body = await request.body()

    signature_header = request.headers.get("Paddle-Signature", "")
    if not verify_paddle_signature(raw_body, signature_header):
        raise HTTPException(status_code=401, detail="Invalid Paddle signature")

    payload = json.loads(raw_body)
    event_type = payload.get("event_type")
    data = payload.get("data", {})

    print(f"Paddle webhook received: {event_type}")

    custom_data = data.get("custom_data") or {}
    user_id_raw = custom_data.get("user_id")
    paddle_subscription_id = data.get("id")
    paddle_customer_id = data.get("customer_id")
    status = data.get("status")

    next_billed_at = parse_datetime(data.get("next_billed_at"))
    current_period = data.get("current_billing_period") or {}
    current_period_ends_at = parse_datetime(current_period.get("ends_at"))
    scheduled_change = data.get("scheduled_change")

    items = data.get("items", [])
    price_id = items[0].get("price", {}).get("id") if items else None

    if event_type == "subscription.created":
        if not user_id_raw:
            print("Warning: subscription.created received with no user_id in custom_data")
            return {"status": "ok"}

        user_id = int(user_id_raw)
        upsert_subscription(user_id, {
            "paddle_subscription_id": paddle_subscription_id,
            "paddle_customer_id": paddle_customer_id,
            "status": status,
            "price_id": price_id,
            "next_billed_at": next_billed_at,
            "current_period_ends_at": current_period_ends_at,
            "scheduled_change": scheduled_change,
        })
        print(f"Subscription created for user {user_id}: status={status}")

    elif event_type == "subscription.updated":
        if not paddle_subscription_id:
            print("Warning: subscription.updated received with no subscription id")
            return {"status": "ok"}

        update_subscription_by_paddle_id(paddle_subscription_id, {
            "status": status,
            "next_billed_at": next_billed_at,
            "current_period_ends_at": current_period_ends_at,
            "scheduled_change": scheduled_change,
        })
        print(f"Subscription {paddle_subscription_id} updated: status={status}")

    return {"status": "ok"}