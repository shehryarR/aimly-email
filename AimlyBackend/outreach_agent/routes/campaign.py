from datetime import datetime
"""
Campaign Management Routes
Handles CRUD operations for campaigns with server-side sorting.

PREFERENCE EMBEDDING:
- GET /campaign/ returns the full campaign_preferences object nested under each campaign.
- Also includes a `brand` preview (id, name, business_name, email_address, logo_data)
  resolved via LEFT JOIN through campaign_preferences.brand_id.
- Logo BLOBs are excluded from the list response (fetch via the preference endpoint).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, validator
from typing import List, Optional, Literal
import base64
from core.database.connection import get_connection
from routes.auth import get_current_user

campaign_router = APIRouter(prefix="/campaign", tags=["Campaign Management"])


# ── Pydantic Models ────────────────────────────────────────────────────────────

class CampaignCreateRequest(BaseModel):
    name: str

    @validator("name")
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Campaign name is required")
        return v


class CampaignUpdateRequest(BaseModel):
    id: int
    name: Optional[str] = None


class BrandPreview(BaseModel):
    """Lightweight brand summary embedded in campaign list response."""
    id: Optional[int] = None
    business_name: Optional[str] = None
    email_address: Optional[str] = None
    logo_data: Optional[str] = None  # base64 data URL


class CampaignPreferenceInline(BaseModel):
    """
    Campaign preference fields embedded in the campaign list response.
    Logo BLOB excluded — fetch via GET /campaign/{id}/campaign_preference/ when needed.
    """
    id: Optional[int] = None
    campaign_id: Optional[int] = None
    brand_id: Optional[int] = None
    bcc: Optional[str] = None
    goal: Optional[str] = None
    value_prop: Optional[str] = None
    tone: Optional[str] = None
    cta: Optional[str] = None
    writing_guidelines: Optional[str] = None
    additional_notes: Optional[str] = None
    template_email: Optional[str] = None
    template_html_email: Optional[int] = None
    inherit_global_settings: Optional[int] = None
    inherit_global_attachments: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    preference: Optional[CampaignPreferenceInline] = None
    brand: Optional[BrandPreview] = None


class CampaignsListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int
    page: int
    size: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    created: int = 0
    updated: int = 0


# ── Helpers ────────────────────────────────────────────────────────────────────

def _logo_to_data_url(logo_bytes, mime_type) -> Optional[str]:
    if logo_bytes and mime_type:
        try:
            b64 = base64.b64encode(logo_bytes).decode("utf-8")
            return f"data:{mime_type};base64,{b64}"
        except Exception:
            return None
    return None


# ==================================================================================
# POST /campaign - Create campaigns
# ==================================================================================
@campaign_router.post("/", response_model=MessageResponse)
def create_campaigns(
    campaigns: List[CampaignCreateRequest],
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    created_count = 0

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            for campaign in campaigns:
                cursor.execute(
                    "INSERT INTO campaigns (user_id, name) VALUES (%s, %s)",
                    (user_id, campaign.name)
                )
                campaign_id = cursor.lastrowid
                cursor.execute(
                    "INSERT INTO campaign_preferences (campaign_id) VALUES (%s)",
                    (campaign_id,)
                )
                created_count += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully created {created_count} campaigns",
        success=True,
        created=created_count,
    )


# ==================================================================================
# PUT /campaign - Update campaigns
# ==================================================================================
@campaign_router.put("/", response_model=MessageResponse)
def update_campaigns(
    campaigns: List[CampaignUpdateRequest],
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    updated_count = 0

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            for campaign in campaigns:
                cursor.execute(
                    "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
                    (campaign.id, user_id)
                )
                if not cursor.fetchone():
                    continue

                update_fields = []
                update_values = []

                if campaign.name is not None:
                    update_fields.append("name = %s")
                    update_values.append(campaign.name.strip())

                if update_fields:
                    update_values.append(campaign.id)
                    cursor.execute(
                        f"UPDATE campaigns SET {', '.join(update_fields)} WHERE id = %s",
                        update_values,
                    )
                    if cursor.rowcount > 0:
                        updated_count += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully updated {updated_count} campaigns",
        success=True,
        updated=updated_count,
    )


# ==================================================================================
# GET /campaign - Get campaigns with pagination, sorting, embedded preferences + brand
# ==================================================================================
@campaign_router.get("/", response_model=CampaignsListResponse)
def get_campaigns(
    ids: Optional[str] = Query(None, description="Comma-separated campaign IDs"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=500),
    search: Optional[str] = Query(None, description="Search by campaign name (case-insensitive)"),
    sort_by: Optional[Literal['name', 'companies', 'sent', 'read', 'scheduled']] = Query(None),
    sort_order: Literal['asc', 'desc'] = Query('asc'),
    current_user: dict = Depends(get_current_user)
):
    """
    Get campaigns with pagination, sorting, and embedded preferences + brand preview.

    Each campaign includes:
      - `preference`: all campaign_preferences fields (excluding logo BLOB)
      - `brand`: id, name, business_name, email_address, logo_data (base64) from
                 the linked brand (via campaign_preferences.brand_id). NULL if no brand set.
    """
    user_id = current_user["user_id"]

    # Preference columns (all except logo BLOB/mime — excluded from list)
    PREF_COLS = """
        cp.id                         AS pref_id,
        cp.campaign_id                AS pref_campaign_id,
        cp.brand_id                   AS pref_brand_id,
        cp.bcc                        AS pref_bcc,
        cp.goal                       AS pref_goal,
        cp.value_prop                 AS pref_value_prop,
        cp.tone                       AS pref_tone,
        cp.cta                        AS pref_cta,
        cp.writing_guidelines         AS pref_writing_guidelines,
        cp.additional_notes           AS pref_additional_notes,
        cp.template_email             AS pref_template_email,
        cp.template_html_email        AS pref_template_html_email,
        cp.inherit_global_settings    AS pref_inherit_global_settings,
        cp.inherit_global_attachments AS pref_inherit_global_attachments,
        cp.created_at                 AS pref_created_at,
        cp.updated_at                 AS pref_updated_at
    """

    # Brand preview columns (via LEFT JOIN on cp.brand_id)
    BRAND_COLS = """
        b.id            AS brand_id,
        b.business_name AS brand_business_name,
        b.email_address AS brand_email_address,
        b.logo          AS brand_logo,
        b.logo_mime_type AS brand_logo_mime_type
    """

    BRAND_JOIN = "LEFT JOIN brands b ON b.id = cp.brand_id"

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Fetch by specific IDs ──────────────────────────────────────────────
        if ids:
            campaign_ids = [int(i.strip()) for i in ids.split(',') if i.strip().isdigit()]
            if not campaign_ids:
                return CampaignsListResponse(campaigns=[], total=0, page=page, size=size)

            placeholders = ','.join(['%s'] * len(campaign_ids))
            cursor.execute(f"""
                SELECT c.*, {PREF_COLS}, {BRAND_COLS}
                FROM campaigns c
                LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
                {BRAND_JOIN}
                WHERE c.user_id = %s AND c.id IN ({placeholders})
                ORDER BY c.created_at DESC
            """, [user_id] + campaign_ids)

            rows = cursor.fetchall()
            total = len(rows)

        # ── Paginated fetch with optional search and sorting ───────────────────
        else:
            offset = (page - 1) * size
            where_clause = "c.user_id = %s"
            where_values: list = [user_id]

            if search and search.strip():
                where_clause += " AND c.name LIKE %s"
                where_values.append(f"%{search.strip()}%")

            sort_direction = "DESC" if sort_order == "desc" else "ASC"

            if sort_by in ['companies', 'sent', 'read', 'scheduled']:
                stats_column_map = {
                    'companies': 'COUNT(DISTINCT cc.company_id)',
                    'sent':      'SUM(CASE WHEN e.status = "sent" THEN 1 ELSE 0 END)',
                    'read':      'SUM(CASE WHEN e.read_at IS NOT NULL THEN 1 ELSE 0 END)',
                    'scheduled': 'SUM(CASE WHEN e.status = "scheduled" THEN 1 ELSE 0 END)',
                }
                stats_column = stats_column_map[sort_by]
                order_by_clause = f"{stats_column} {sort_direction}, c.id ASC"

                cursor.execute(
                    f"SELECT COUNT(DISTINCT c.id) as total FROM campaigns c WHERE {where_clause}",
                    where_values,
                )
                total = cursor.fetchone()["total"]

                fetch_query = f"""
                    SELECT c.*, {PREF_COLS}, {BRAND_COLS}
                    FROM campaigns c
                    LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
                    {BRAND_JOIN}
                    LEFT JOIN campaign_company cc ON c.id = cc.campaign_id
                    LEFT JOIN emails e ON cc.id = e.campaign_company_id
                    WHERE {where_clause}
                    GROUP BY c.id, cp.id, b.id
                    ORDER BY {order_by_clause}
                    LIMIT %s OFFSET %s
                """
                where_values.extend([size, offset])

            else:
                if sort_by == 'name':
                    order_by_clause = f"LOWER(c.name) {sort_direction}"
                else:
                    order_by_clause = "c.created_at DESC"

                cursor.execute(
                    f"SELECT COUNT(*) as total FROM campaigns c WHERE {where_clause}",
                    where_values,
                )
                total = cursor.fetchone()["total"]

                fetch_query = f"""
                    SELECT c.*, {PREF_COLS}, {BRAND_COLS}
                    FROM campaigns c
                    LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
                    {BRAND_JOIN}
                    WHERE {where_clause}
                    ORDER BY {order_by_clause}
                    LIMIT %s OFFSET %s
                """
                where_values.extend([size, offset])

            cursor.execute(fetch_query, where_values)
            rows = cursor.fetchall()

        # ── Build response ─────────────────────────────────────────────────────
        campaign_list = []
        for row in rows:
            r = dict(row)

            preference = None
            if r.get("pref_id") is not None:
                preference = CampaignPreferenceInline(
                    id=r.get("pref_id"),
                    campaign_id=r.get("pref_campaign_id"),
                    brand_id=r.get("pref_brand_id"),
                    bcc=r.get("pref_bcc"),
                    goal=r.get("pref_goal"),
                    value_prop=r.get("pref_value_prop"),
                    tone=r.get("pref_tone"),
                    cta=r.get("pref_cta"),
                    writing_guidelines=r.get("pref_writing_guidelines"),
                    additional_notes=r.get("pref_additional_notes"),
                    template_email=r.get("pref_template_email"),
                    template_html_email=r.get("pref_template_html_email"),
                    inherit_global_settings=r.get("pref_inherit_global_settings"),
                    inherit_global_attachments=r.get("pref_inherit_global_attachments"),
                    created_at=r.get("pref_created_at"),
                    updated_at=r.get("pref_updated_at"),
                )

            brand = None
            if r.get("brand_id") is not None:
                brand = BrandPreview(
                    id=r.get("brand_id"),
                    business_name=r.get("brand_business_name"),
                    email_address=r.get("brand_email_address"),
                    logo_data=_logo_to_data_url(r.get("brand_logo"), r.get("brand_logo_mime_type")),
                )

            campaign_list.append(CampaignResponse(
                id=r["id"],
                user_id=r["user_id"],
                name=r["name"],
                created_at=r["created_at"],
                preference=preference,
                brand=brand,
            ))

    return CampaignsListResponse(
        campaigns=campaign_list,
        total=total,
        page=page,
        size=size,
    )


# ==================================================================================
# DELETE /campaign - Delete campaigns
# ==================================================================================
@campaign_router.delete("/", response_model=MessageResponse)
def delete_campaigns(
    ids: str = Query(..., description="Comma-separated campaign IDs"),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    campaign_ids = [int(i.strip()) for i in ids.split(',') if i.strip().isdigit()]

    if not campaign_ids:
        raise HTTPException(status_code=400, detail="No valid campaign IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            placeholders = ','.join(['%s'] * len(campaign_ids))
            cursor.execute(
                f"DELETE FROM campaigns WHERE user_id = %s AND id IN ({placeholders})",
                [user_id] + campaign_ids,
            )
            deleted_count = cursor.rowcount
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully deleted {deleted_count} campaigns",
        success=True,
    )