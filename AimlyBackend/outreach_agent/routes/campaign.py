from datetime import datetime
"""
Campaign Management Routes - CORRECTED FOR ACTUAL SCHEMA
Handles CRUD operations for campaigns with server-side sorting.
Works with the campaign_company junction table.

PREFERENCE EMBEDDING:
- GET /campaign/ now returns the full campaign_preferences object nested under
  each campaign as `preference`. Logo BLOB is excluded from the list response
  (fetch it via GET /campaign/{id}/campaign_preference/ when needed).
- This eliminates all N calls to GET /campaign/{id}/campaign_preference/ that
  were previously made after loading the campaign list.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, validator
from typing import List, Optional, Literal
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


class CampaignPreferenceInline(BaseModel):
    """
    Campaign preference fields embedded in the campaign list response.
    Logo BLOB is excluded — fetch via GET /campaign/{id}/campaign_preference/ when needed.
    """
    id: Optional[int] = None
    campaign_id: Optional[int] = None
    bcc: Optional[str] = None
    business_name: Optional[str] = None
    business_info: Optional[str] = None
    goal: Optional[str] = None
    value_prop: Optional[str] = None
    tone: Optional[str] = None
    cta: Optional[str] = None
    extras: Optional[str] = None
    email_instruction: Optional[str] = None
    signature: Optional[str] = None
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


# ==================================================================================
# POST /campaign - Create a list of campaigns
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
                cursor.execute("""
                    INSERT INTO campaigns (user_id, name)
                    VALUES (%s, %s)
                """, (user_id, campaign.name))

                campaign_id = cursor.lastrowid

                cursor.execute("""
                    INSERT INTO campaign_preferences (campaign_id)
                    VALUES (%s)
                """, (campaign_id,))

                created_count += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully created {created_count} campaigns",
        success=True,
        created=created_count
    )


# ==================================================================================
# PUT /campaign - Update a list of campaigns
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
                cursor.execute("""
                    SELECT id FROM campaigns
                    WHERE id = %s AND user_id = %s
                """, (campaign.id, user_id))

                if not cursor.fetchone():
                    continue

                update_fields = []
                update_values = []

                if campaign.name is not None:
                    update_fields.append("name = %s")
                    update_values.append(campaign.name.strip())

                if update_fields:
                    update_values.append(campaign.id)
                    query = f"UPDATE campaigns SET {', '.join(update_fields)} WHERE id = %s"
                    cursor.execute(query, update_values)

                    if cursor.rowcount > 0:
                        updated_count += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully updated {updated_count} campaigns",
        success=True,
        updated=updated_count
    )


# ==================================================================================
# GET /campaign - Get campaigns with pagination, sorting, and embedded preferences
#
# Each campaign now includes a `preference` object with all campaign_preferences
# fields except the logo BLOB. Fetch the logo separately via the preference endpoint.
# ==================================================================================
@campaign_router.get("/", response_model=CampaignsListResponse)
def get_campaigns(
    ids: Optional[str] = Query(
        None,
        description="Comma-separated campaign IDs"
    ),
    page: int = Query(
        1,
        ge=1,
        description="Page number (1-indexed)"
    ),
    size: int = Query(
        10,
        ge=1,
        le=500,
        description="Items per page"
    ),
    search: Optional[str] = Query(
        None,
        description="Search by campaign name (case-insensitive)"
    ),
    sort_by: Optional[Literal['name', 'companies', 'sent', 'read', 'scheduled']] = Query(
        None,
        description="Sort field: name, companies, sent, read, scheduled"
    ),
    sort_order: Literal['asc', 'desc'] = Query(
        'asc',
        description="Sort order: asc or desc"
    ),
    current_user: dict = Depends(get_current_user)
):
    """
    Get campaigns with pagination, sorting, and embedded preferences.

    Query Parameters:
    - ids=1,2,3              → fetch specific campaigns (ignores search/page/size)
    - search=hello           → filter by name LIKE '%hello%'
    - page=1&size=10         → pagination (1-indexed)
    - sort_by=name           → sort by: name, companies, sent, read, scheduled
    - sort_order=asc         → sort direction: asc or desc

    Each campaign includes a `preference` object with all campaign_preferences
    fields (excluding logo BLOB). preference is null if no preferences row exists.
    """
    user_id = current_user["user_id"]

    # Preference columns to SELECT (all except logo BLOB and logo_mime_type)
    PREF_COLS = """
        cp.id               AS pref_id,
        cp.campaign_id      AS pref_campaign_id,
        cp.bcc              AS pref_bcc,
        cp.business_name    AS pref_business_name,
        cp.business_info    AS pref_business_info,
        cp.goal             AS pref_goal,
        cp.value_prop       AS pref_value_prop,
        cp.tone             AS pref_tone,
        cp.cta              AS pref_cta,
        cp.extras           AS pref_extras,
        cp.email_instruction        AS pref_email_instruction,
        cp.signature                AS pref_signature,
        cp.template_email           AS pref_template_email,
        cp.template_html_email      AS pref_template_html_email,
        cp.inherit_global_settings  AS pref_inherit_global_settings,
        cp.inherit_global_attachments AS pref_inherit_global_attachments,
        cp.created_at       AS pref_created_at,
        cp.updated_at       AS pref_updated_at
    """

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Fetch by specific IDs ──────────────────────────────────────────────
        if ids:
            campaign_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]

            if not campaign_ids:
                return CampaignsListResponse(campaigns=[], total=0, page=page, size=size)

            placeholders = ','.join(['%s'] * len(campaign_ids))
            cursor.execute(f"""
                SELECT c.*, {PREF_COLS}
                FROM campaigns c
                LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
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

                cursor.execute(f"""
                    SELECT COUNT(DISTINCT c.id) as total
                    FROM campaigns c
                    WHERE {where_clause}
                """, where_values)
                total = cursor.fetchone()["total"]

                fetch_query = f"""
                    SELECT c.*, {PREF_COLS}
                    FROM campaigns c
                    LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
                    LEFT JOIN campaign_company cc ON c.id = cc.campaign_id
                    LEFT JOIN emails e ON cc.id = e.campaign_company_id
                    WHERE {where_clause}
                    GROUP BY c.id, cp.id
                    ORDER BY {order_by_clause}
                    LIMIT %s OFFSET %s
                """
                where_values.extend([size, offset])

            else:
                if sort_by == 'name':
                    order_by_clause = f"LOWER(c.name) {sort_direction}"
                else:
                    order_by_clause = "c.created_at DESC"

                cursor.execute(f"""
                    SELECT COUNT(*) as total
                    FROM campaigns c
                    WHERE {where_clause}
                """, where_values)
                total = cursor.fetchone()["total"]

                fetch_query = f"""
                    SELECT c.*, {PREF_COLS}
                    FROM campaigns c
                    LEFT JOIN campaign_preferences cp ON cp.campaign_id = c.id
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
            row_dict = dict(row)

            # Extract preference fields (prefixed with pref_)
            preference = None
            if row_dict.get("pref_id") is not None:
                preference = CampaignPreferenceInline(
                    id=row_dict.get("pref_id"),
                    campaign_id=row_dict.get("pref_campaign_id"),
                    bcc=row_dict.get("pref_bcc"),
                    business_name=row_dict.get("pref_business_name"),
                    business_info=row_dict.get("pref_business_info"),
                    goal=row_dict.get("pref_goal"),
                    value_prop=row_dict.get("pref_value_prop"),
                    tone=row_dict.get("pref_tone"),
                    cta=row_dict.get("pref_cta"),
                    extras=row_dict.get("pref_extras"),
                    email_instruction=row_dict.get("pref_email_instruction"),
                    signature=row_dict.get("pref_signature"),
                    template_email=row_dict.get("pref_template_email"),
                    template_html_email=row_dict.get("pref_template_html_email"),
                    inherit_global_settings=row_dict.get("pref_inherit_global_settings"),
                    inherit_global_attachments=row_dict.get("pref_inherit_global_attachments"),
                    created_at=row_dict.get("pref_created_at"),
                    updated_at=row_dict.get("pref_updated_at"),
                )

            campaign_list.append(CampaignResponse(
                id=row_dict["id"],
                user_id=row_dict["user_id"],
                name=row_dict["name"],
                created_at=row_dict["created_at"],
                preference=preference,
            ))

    return CampaignsListResponse(
        campaigns=campaign_list,
        total=total,
        page=page,
        size=size
    )


# ==================================================================================
# DELETE /campaign - Delete campaigns by IDs
# ==================================================================================
@campaign_router.delete("/", response_model=MessageResponse)
def delete_campaigns(
    ids: str = Query(..., description="Comma-separated campaign IDs"),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    campaign_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]

    if not campaign_ids:
        raise HTTPException(status_code=400, detail="No valid campaign IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            placeholders = ','.join(['%s'] * len(campaign_ids))
            cursor.execute(f"""
                DELETE FROM campaigns
                WHERE user_id = %s AND id IN ({placeholders})
            """, [user_id] + campaign_ids)

            deleted_count = cursor.rowcount
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete campaigns: {str(e)}")

    return MessageResponse(
        message=f"Successfully deleted {deleted_count} campaigns",
        success=True
    )