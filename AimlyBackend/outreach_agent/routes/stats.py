"""
Statistics and Analytics Routes
Provides aggregated metrics and statistics for campaigns and overall account
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
from core.database.connection import get_connection
from routes.auth import get_current_user

stats_router = APIRouter(prefix="/stats", tags=["Statistics"])

# Pydantic Models
class EmailStats(BaseModel):
    sent: int = 0
    read: int = 0
    failed: int = 0
    draft: int = 0
    scheduled: int = 0
    primary: int = 0
    total: int = 0

class CampaignStats(BaseModel):
    campaign_id: int
    campaign_name: str
    companies_count: int
    emails: EmailStats
    read_rate: float = 0.0

class AccountStats(BaseModel):
    total_campaigns: int
    total_companies: int
    total_campaign_companies: int
    total_attachments: int = 0
    total_categories: int = 0
    emails: EmailStats
    overall_read_rate: float = 0.0


def _process_email_stats(email_stats_raw) -> tuple:
    """
    Process raw email status rows into an EmailStats object and read rate.

    Schema note: there is no 'read' status. When an email is opened, read_at
    is populated but status remains 'sent'. So:
      - emails.read  = count of sent emails where read_at IS NOT NULL
      - emails.sent  = count of sent emails (including those already read)
      - read_rate    = emails.read / emails.sent * 100
      - emails.total = all statuses summed
    """
    emails = EmailStats()

    for row in email_stats_raw:
        status     = row["status"]
        count      = row["count"]
        read_count = row["read_count"]

        if status == "sent":
            emails.sent = count
            emails.read = read_count   # read_at IS NOT NULL within the sent group
        elif status == "failed":
            emails.failed = count
        elif status == "draft":
            emails.draft = count
        elif status == "scheduled":
            emails.scheduled = count
        elif status == "primary":
            emails.primary = count

    emails.total = (
        emails.sent
        + emails.failed
        + emails.draft
        + emails.scheduled
        + emails.primary
    )

    read_rate = (emails.read / emails.sent * 100) if emails.sent > 0 else 0.0

    return emails, read_rate


# ==================================================================================
# GET /stats - Get accumulated stats, or per-campaign stats for given IDs
# ==================================================================================
@stats_router.get("/", response_model=None)
def get_account_stats(
    campaign_ids: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get stats for the account.

    - campaign_ids=1,2,3 → returns per-campaign stats for those campaigns in one query
    - no campaign_ids    → returns accumulated stats across all campaigns
    """
    user_id = current_user["user_id"]

    # ── Per-campaign bulk stats ────────────────────────────────────────────────
    if campaign_ids and campaign_ids.strip():
        ids = [int(x.strip()) for x in campaign_ids.split(",") if x.strip().isdigit()]
        if not ids:
            return {"campaigns": []}

        with get_connection() as conn:
            cursor = conn.cursor()

            ph = ",".join(["%s"] * len(ids))

            # Verify all campaign IDs belong to user and get names
            cursor.execute(f"""
                SELECT id, name, created_at
                FROM campaigns
                WHERE id IN ({ph}) AND user_id = %s
            """, ids + [user_id])
            campaigns = {r["id"]: r for r in cursor.fetchall()}

            # Companies count per campaign
            cursor.execute(f"""
                SELECT campaign_id, COUNT(*) as companies_count
                FROM campaign_company
                WHERE campaign_id IN ({ph})
                GROUP BY campaign_id
            """, ids)
            companies_map = {r["campaign_id"]: r["companies_count"] for r in cursor.fetchall()}

            # Email stats per campaign in one query
            cursor.execute(f"""
                SELECT
                    cc.campaign_id,
                    e.status,
                    COUNT(*) as count,
                    SUM(CASE WHEN e.read_at IS NOT NULL THEN 1 ELSE 0 END) as read_count
                FROM emails e
                JOIN campaign_company cc ON e.campaign_company_id = cc.id
                WHERE cc.campaign_id IN ({ph})
                GROUP BY cc.campaign_id, e.status
            """, ids)

            # Group rows by campaign_id
            rows_by_campaign: Dict[int, list] = {i: [] for i in ids}
            for row in cursor.fetchall():
                rows_by_campaign[row["campaign_id"]].append(row)

        results = []
        for cid in ids:
            if cid not in campaigns:
                continue
            c = campaigns[cid]
            emails, read_rate = _process_email_stats(rows_by_campaign[cid])
            results.append({
                "campaign_id":     cid,
                "campaign_name":   c["name"],
                "companies_count": companies_map.get(cid, 0),
                "created_at":      c["created_at"],
                "emails": {
                    "sent":      emails.sent,
                    "read":      emails.read,
                    "failed":    emails.failed,
                    "draft":     emails.draft,
                    "scheduled": emails.scheduled,
                    "primary":   emails.primary,
                    "total":     emails.total,
                },
                "read_rate": round(read_rate, 2),
            })

        return {"campaigns": results}

    # ── Accumulated stats (no campaign_ids) ────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as total FROM campaigns WHERE user_id = %s", (user_id,))
        total_campaigns = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM companies WHERE user_id = %s", (user_id,))
        total_companies = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) as total
            FROM campaign_company cc
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE c.user_id = %s
        """, (user_id,))
        total_campaign_companies = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM attachments WHERE user_id = %s", (user_id,))
        total_attachments = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM categories WHERE user_id = %s", (user_id,))
        total_categories = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT
                e.status,
                COUNT(*) as count,
                SUM(CASE WHEN e.read_at IS NOT NULL THEN 1 ELSE 0 END) as read_count
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE c.user_id = %s
            GROUP BY e.status
        """, (user_id,))

        emails, overall_read_rate = _process_email_stats(cursor.fetchall())

    return AccountStats(
        total_campaigns=total_campaigns,
        total_companies=total_companies,
        total_campaign_companies=total_campaign_companies,
        total_attachments=total_attachments,
        total_categories=total_categories,
        emails=emails,
        overall_read_rate=round(overall_read_rate, 2),
    )