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

class CampaignDetailStats(BaseModel):
    campaign_id: int
    campaign_name: str
    companies_count: int
    emails: EmailStats
    read_rate: float = 0.0
    created_at: str


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
# GET /stats - Get accumulated stats across all campaigns
# ==================================================================================
@stats_router.get("/", response_model=AccountStats)
def get_account_stats(current_user: dict = Depends(get_current_user)):
    """
    Get accumulated stats across all campaigns.
    Returns comprehensive statistics for the entire user account.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # Get total campaigns
        cursor.execute("""
            SELECT COUNT(*) as total FROM campaigns WHERE user_id = %s
        """, (user_id,))
        total_campaigns = cursor.fetchone()["total"]

        # Get total companies
        cursor.execute("""
            SELECT COUNT(*) as total FROM companies WHERE user_id = %s
        """, (user_id,))
        total_companies = cursor.fetchone()["total"]

        # Get total campaign-company relationships
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM campaign_company cc
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE c.user_id = %s
        """, (user_id,))
        total_campaign_companies = cursor.fetchone()["total"]

        # Get total attachments
        cursor.execute("""
            SELECT COUNT(*) as total FROM attachments WHERE user_id = %s
        """, (user_id,))
        total_attachments = cursor.fetchone()["total"]

        # Get total categories
        cursor.execute("""
            SELECT COUNT(*) as total FROM categories WHERE user_id = %s
        """, (user_id,))
        total_categories = cursor.fetchone()["total"]

        # Get overall email statistics grouped by status.
        # read_count counts sent emails that have been opened (read_at IS NOT NULL).
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


# ==================================================================================
# GET /stats/{campaign_id} - Get stats for a specific campaign
# ==================================================================================
@stats_router.get("/{campaign_id}/", response_model=CampaignDetailStats)
def get_campaign_stats(campaign_id: int, current_user: dict = Depends(get_current_user)):
    """
    Get stats for a specific campaign.
    Returns detailed statistics for a single campaign.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify campaign belongs to user and get campaign info
        cursor.execute("""
            SELECT id, name, created_at
            FROM campaigns
            WHERE id = %s AND user_id = %s
        """, (campaign_id, user_id))

        campaign = cursor.fetchone()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Get companies count for this campaign
        cursor.execute("""
            SELECT COUNT(*) as companies_count
            FROM campaign_company cc
            WHERE cc.campaign_id = %s
        """, (campaign_id,))
        companies_count = cursor.fetchone()["companies_count"]

        # Get email statistics for this campaign grouped by status.
        # read_count counts sent emails that have been opened (read_at IS NOT NULL).
        cursor.execute("""
            SELECT
                e.status,
                COUNT(*) as count,
                SUM(CASE WHEN e.read_at IS NOT NULL THEN 1 ELSE 0 END) as read_count
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            WHERE cc.campaign_id = %s
            GROUP BY e.status
        """, (campaign_id,))

        emails, read_rate = _process_email_stats(cursor.fetchall())

    return CampaignDetailStats(
        campaign_id=campaign["id"],
        campaign_name=campaign["name"],
        companies_count=companies_count,
        emails=emails,
        read_rate=round(read_rate, 2),
        created_at=campaign["created_at"]
    )