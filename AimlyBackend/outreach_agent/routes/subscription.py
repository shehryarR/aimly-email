"""
Subscription Routes — Paddle Billing Integration
Handles subscription status checks and Paddle webhook events.

Endpoints:
  GET  /subscription/status   — returns current user's subscription status + plan limits
  POST /subscription/webhook  — receives and processes Paddle webhook events
"""

import os
import hmac
import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from core.database.connection import get_connection as get_db_connection
from middleware.auth import get_current_user
from core.plans import get_plan_limits, PLANS, ACTIVE_STATUSES, get_slug_for_price_id

subscription_router = APIRouter(prefix="/subscription", tags=["subscription"])

# ── Paddle config ─────────────────────────────────────────────────────────────
PADDLE_WEBHOOK_SECRET = os.getenv("PADDLE_WEBHOOK_SECRET", "")
PADDLE_ENABLED = os.getenv("PADDLE_ENABLED", "true").lower() == "true"


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_subscription_by_user(user_id: int) -> dict | None:
    """Fetch subscription row for a given user_id."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM subscriptions WHERE user_id = %s",
            (user_id,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def get_subscription_by_paddle_id(paddle_subscription_id: str) -> dict | None:
    """Fetch subscription row by Paddle subscription ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM subscriptions WHERE paddle_subscription_id = %s",
            (paddle_subscription_id,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def update_subscription_by_paddle_id(paddle_subscription_id: str, data: dict):
    """
    Update an existing subscription row by Paddle subscription ID.
    Also updates price_id and plan_slug — handles plan upgrades/downgrades
    where the price_id changes on subscription.updated events.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE subscriptions
            SET status                 = %s,
                price_id               = %s,
                plan_slug              = %s,
                next_billed_at         = %s,
                current_period_ends_at = %s,
                scheduled_change       = %s,
                updated_at             = CURRENT_TIMESTAMP
            WHERE paddle_subscription_id = %s
        """, (
            data.get("status"),
            data.get("price_id"),
            data.get("plan_slug"),
            data.get("next_billed_at"),
            data.get("current_period_ends_at"),
            json.dumps(data.get("scheduled_change")) if data.get("scheduled_change") else None,
            paddle_subscription_id,
        ))
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def update_subscription_by_user(user_id: int, data: dict):
    """Upsert subscription row by user_id (used on subscription.created)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO subscriptions (
                user_id, paddle_subscription_id, paddle_customer_id,
                status, price_id, plan_slug, next_billed_at,
                current_period_ends_at, scheduled_change
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                paddle_subscription_id = VALUES(paddle_subscription_id),
                paddle_customer_id     = VALUES(paddle_customer_id),
                status                 = VALUES(status),
                price_id               = VALUES(price_id),
                plan_slug              = VALUES(plan_slug),
                next_billed_at         = VALUES(next_billed_at),
                current_period_ends_at = VALUES(current_period_ends_at),
                scheduled_change       = VALUES(scheduled_change),
                updated_at             = CURRENT_TIMESTAMP
        """, (
            user_id,
            data.get("paddle_subscription_id"),
            data.get("paddle_customer_id"),
            data.get("status"),
            data.get("price_id"),
            data.get("plan_slug"),
            data.get("next_billed_at"),
            data.get("current_period_ends_at"),
            json.dumps(data.get("scheduled_change")) if data.get("scheduled_change") else None,
        ))
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def verify_paddle_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify Paddle webhook signature.
    Paddle sends: Paddle-Signature: ts=<timestamp>;h1=<hmac_hash>
    Docs: https://developer.paddle.com/webhooks/signature-verification
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
    Returns the current user's subscription status and plan limits.
    Called by the frontend on every page load to decide whether to show the
    paywall and which features/limits to expose.

    Response includes:
      has_access             — bool: whether the user can use the app
      status                 — Paddle subscription status string
      plan_name              — "Solo" | "Studio" | "Agency" | null
      plan_slug              — "solo" | "studio" | "agency" | null
      max_brands             — int | null (null = unlimited)
      daily_email_cap        — int: max emails sendable per UTC day
      special_access         — bool
      next_billed_at         — datetime | null
      current_period_ends_at — datetime | null
    """
    user = get_current_user(request)
    user_id = user["user_id"]

    # Paddle disabled — grant full access to everyone
    if not PADDLE_ENABLED:
        return {
            "status":                 "active",
            "has_access":             True,
            "special_access":         False,
            "plan_name":              "Agency",
            "plan_slug":              "agency",
            "max_brands":             None,
            "daily_email_cap":        7500,
            "next_billed_at":         None,
            "current_period_ends_at": None,
        }

    subscription = get_subscription_by_user(user_id)

    if not subscription:
        return {
            "status":                 "inactive",
            "has_access":             False,
            "special_access":         False,
            "plan_name":              None,
            "plan_slug":              None,
            "max_brands":             0,
            "daily_email_cap":        0,
            "next_billed_at":         None,
            "current_period_ends_at": None,
        }

    status         = subscription.get("status", "inactive")
    special_access = bool(subscription.get("special_access", 0))
    has_access     = special_access or (status in ACTIVE_STATUSES)

    # Resolve plan limits via plans.py (reads plan_slug — never price_id)
    limits = get_plan_limits(user_id)

    return {
        "status":                 status,
        "has_access":             has_access,
        "special_access":         special_access,
        "plan_name":              limits["plan_name"],
        "plan_slug":              limits["plan_slug"],
        "max_brands":             limits["max_brands"],
        "daily_email_cap":        limits["daily_email_cap"],
        "next_billed_at":         subscription.get("next_billed_at"),
        "current_period_ends_at": subscription.get("current_period_ends_at"),
    }


@subscription_router.post("/webhook")
async def paddle_webhook(request: Request):
    """
    Receives Paddle webhook events and updates subscription status in DB.

    No JWT auth — verified by Paddle signature instead.
    Must be added to public_endpoints in OptionalAuthMiddleware.

    Handles per Paddle docs (subscription.created + subscription.updated
    cover the full lifecycle):
      - subscription.created  → new trial or subscription
      - subscription.updated  → any status change (trial→active, past_due,
                                canceled, paused) or plan change

    price_id is resolved to plan_slug HERE using get_slug_for_price_id().
    All downstream enforcement reads plan_slug only.

    Docs: https://developer.paddle.com/build/subscriptions/provision-access-webhooks
    """
    raw_body = await request.body()

    # Verify Paddle signature
    signature_header = request.headers.get("Paddle-Signature", "")
    if not verify_paddle_signature(raw_body, signature_header):
        raise HTTPException(status_code=401, detail="Invalid Paddle signature")

    payload    = json.loads(raw_body)
    event_type = payload.get("event_type")
    data       = payload.get("data", {})

    print(f"Paddle webhook received: {event_type}")

    # user_id passed via customData in Paddle.js checkout
    custom_data            = data.get("custom_data") or {}
    user_id_raw            = custom_data.get("user_id")
    paddle_subscription_id = data.get("id")
    paddle_customer_id     = data.get("customer_id")
    status                 = data.get("status")

    # Per Paddle docs — recommended fields to store
    next_billed_at = parse_datetime(data.get("next_billed_at"))
    current_period = data.get("current_billing_period") or {}
    current_period_ends_at = parse_datetime(current_period.get("ends_at"))
    scheduled_change = data.get("scheduled_change")

    # price_id — from first item in subscription items list
    items    = data.get("items", [])
    price_id = items[0].get("price", {}).get("id") if items else None

    # Resolve price_id → plan_slug HERE, once, at ingestion time.
    # Everything downstream reads plan_slug.
    plan_slug = get_slug_for_price_id(price_id or "")
    if price_id and not plan_slug:
        print(f"[webhook] Warning: unrecognised price_id '{price_id}' — plan_slug will be null")

    if event_type == "subscription.created":
        if not user_id_raw:
            print("Warning: subscription.created received with no user_id in custom_data")
            return {"status": "ok"}

        user_id = int(user_id_raw)
        update_subscription_by_user(user_id, {
            "paddle_subscription_id": paddle_subscription_id,
            "paddle_customer_id":     paddle_customer_id,
            "status":                 status,
            "price_id":               price_id,
            "plan_slug":              plan_slug,
            "next_billed_at":         next_billed_at,
            "current_period_ends_at": current_period_ends_at,
            "scheduled_change":       scheduled_change,
        })
        print(f"Subscription created for user {user_id}: status={status}, plan_slug={plan_slug}")

    elif event_type == "subscription.updated":
        if not paddle_subscription_id:
            print("Warning: subscription.updated received with no subscription id")
            return {"status": "ok"}

        # price_id + plan_slug are updated here too — covers plan upgrades/downgrades
        update_subscription_by_paddle_id(paddle_subscription_id, {
            "status":                 status,
            "price_id":               price_id,
            "plan_slug":              plan_slug,
            "next_billed_at":         next_billed_at,
            "current_period_ends_at": current_period_ends_at,
            "scheduled_change":       scheduled_change,
        })
        print(f"Subscription {paddle_subscription_id} updated: status={status}, plan_slug={plan_slug}")

    return {"status": "ok"}