"""
core/plans.py — Subscription Plan Configuration
================================================
Single source of truth for all plan tiers and their limits.

Plans are keyed by slug ('solo', 'studio', 'agency') — stable identifiers
that never change even if Paddle price_ids are rotated.

price_id → slug mapping happens ONCE at webhook ingestion time and is
written to subscriptions.plan_slug. All enforcement reads plan_slug, never
price_id directly.

Plans:
  solo   — $29/mo  — 1 brand,         500 emails/day
  studio — $79/mo  — 5 brands,      2,500 emails/day
  agency — $199/mo — unlimited brands, 7,500 emails/day
"""

import os
from core.database.connection import get_connection

# ── Paddle price IDs (set in .env) ────────────────────────────────────────────
# Used ONLY at webhook ingestion to resolve → plan_slug.
# Never used for enforcement logic.
PRICE_ID_SOLO   = os.getenv("PADDLE_PRICE_ID_SOLO",   "PRICE_ID_SOLO_PLACEHOLDER")
PRICE_ID_STUDIO = os.getenv("PADDLE_PRICE_ID_STUDIO", "PRICE_ID_STUDIO_PLACEHOLDER")
PRICE_ID_AGENCY = os.getenv("PADDLE_PRICE_ID_AGENCY", "PRICE_ID_AGENCY_PLACEHOLDER")

PADDLE_ENABLED = os.getenv("PADDLE_ENABLED", "true").lower() == "true"

# ── Plan definitions (keyed by slug) ──────────────────────────────────────────
# max_brands: None = unlimited
# daily_email_cap: maximum emails sendable per UTC day
PLANS: dict[str, dict] = {
    "solo": {
        "plan_name":       "Solo",
        "monthly_price":   29,
        "max_brands":      1,
        "daily_email_cap": 500,
        "support":         "Email (48h)",
        "ideal_for":       "Solopreneurs",
    },
    "studio": {
        "plan_name":       "Studio",
        "monthly_price":   79,
        "max_brands":      5,
        "daily_email_cap": 2500,
        "support":         "Priority Email (24h)",
        "ideal_for":       "Growing Teams",
    },
    "agency": {
        "plan_name":       "Agency",
        "monthly_price":   199,
        "max_brands":      None,   # unlimited
        "daily_email_cap": 7500,
        "support":         "Slack / Discord",
        "ideal_for":       "Client Agencies",
    },
}

# ── price_id → slug mapping ────────────────────────────────────────────────────
# Only consulted at webhook time. Update this map if Paddle price IDs are
# rotated — no DB migration or enforcement changes needed.
PRICE_ID_TO_SLUG: dict[str, str] = {
    PRICE_ID_SOLO:   "solo",
    PRICE_ID_STUDIO: "studio",
    PRICE_ID_AGENCY: "agency",
}

# Legacy single-price fallback — maps to studio slug
_LEGACY_PRICE_ID = os.getenv("PADDLE_PRICE_ID", "")
if _LEGACY_PRICE_ID and _LEGACY_PRICE_ID not in PRICE_ID_TO_SLUG:
    PRICE_ID_TO_SLUG[_LEGACY_PRICE_ID] = "studio"

# Limits granted when Paddle is disabled or the user has special_access
_UNRESTRICTED_LIMITS: dict = {
    "plan_name":       "Agency",
    "plan_slug":       "agency",
    "max_brands":      None,
    "daily_email_cap": 7500,
}

# Limits granted when the user has no active subscription
_NO_PLAN_LIMITS: dict = {
    "plan_name":       None,
    "plan_slug":       None,
    "max_brands":      0,
    "daily_email_cap": 0,
}

ACTIVE_STATUSES = {"trialing", "active"}


# ── Public helpers ─────────────────────────────────────────────────────────────

def get_slug_for_price_id(price_id: str) -> str | None:
    """
    Resolve a Paddle price_id to a stable plan slug.
    Returns None if the price_id is unrecognised.
    Called ONLY at webhook ingestion — never at enforcement time.
    """
    return PRICE_ID_TO_SLUG.get(price_id)


def get_plan_limits(user_id: int) -> dict:
    """
    Return the effective plan limits for a user.

    Resolution order:
      1. PADDLE_ENABLED=false               → unrestricted (Agency caps)
      2. special_access=1                   → unrestricted (Agency caps)
      3. Active sub + valid plan_slug       → that plan's limits
      4. Active sub + missing/unknown slug  → Studio limits (safe fallback)
      5. No active subscription             → no access (all limits = 0)

    Returns a dict with keys: plan_name, plan_slug, max_brands, daily_email_cap
    """
    if not PADDLE_ENABLED:
        return _UNRESTRICTED_LIMITS.copy()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT status, plan_slug, special_access FROM subscriptions WHERE user_id = %s",
            (user_id,)
        )
        row = cursor.fetchone()

    if not row:
        return _NO_PLAN_LIMITS.copy()

    # special_access overrides everything
    if row.get("special_access"):
        return _UNRESTRICTED_LIMITS.copy()

    status    = row.get("status", "inactive")
    plan_slug = row.get("plan_slug") or ""

    if status not in ACTIVE_STATUSES:
        return _NO_PLAN_LIMITS.copy()

    plan = PLANS.get(plan_slug)
    if plan:
        return {
            "plan_name":       plan["plan_name"],
            "plan_slug":       plan_slug,
            "max_brands":      plan["max_brands"],
            "daily_email_cap": plan["daily_email_cap"],
        }

    # Active subscription but unrecognised/missing plan_slug — fallback to Studio
    print(f"[plans] Warning: unrecognised plan_slug '{plan_slug}' for user {user_id}. Falling back to Studio.")
    studio = PLANS["studio"]
    return {
        "plan_name":       studio["plan_name"],
        "plan_slug":       "studio",
        "max_brands":      studio["max_brands"],
        "daily_email_cap": studio["daily_email_cap"],
    }


def get_daily_sends_count(user_id: int) -> int:
    """
    Count emails sent today (UTC) for a user across all campaigns.
    Only counts status='sent' with sent_at within the current UTC day.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) AS cnt
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE c.user_id = %s
              AND e.status = 'sent'
              AND DATE(e.sent_at) = CURDATE()
        """, (user_id,))
        row = cursor.fetchone()
    return row["cnt"] if row else 0