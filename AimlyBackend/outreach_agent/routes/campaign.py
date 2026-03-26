"""
Campaign Management Routes - CORRECTED FOR ACTUAL SCHEMA
Handles CRUD operations for campaigns with server-side sorting
Works with the campaign_company junction table
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, validator
from typing import List, Optional, Literal
from core.database.connection import get_connection
from routes.auth import get_current_user

campaign_router = APIRouter(prefix="/campaign", tags=["Campaign Management"])

# Pydantic Models
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


class CampaignResponse(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: str

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
# GET /campaign - Get campaigns with pagination and sorting
# FIXED FOR ACTUAL SCHEMA: Handles campaign_company junction table
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
    Get campaigns with pagination and sorting.

    Query Parameters:
    - ids=1,2,3              → fetch specific campaigns (ignores search/page/size)
    - search=hello           → filter by name LIKE '%hello%'
    - page=1&size=10         → pagination (1-indexed)
    - sort_by=name           → sort by: name, companies, sent, read, scheduled
    - sort_order=asc         → sort direction: asc or desc

    Sorting applies across ALL campaigns (before pagination).
    Stats-based sorting (companies, sent, read, scheduled) aggregates from emails.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Fetch by specific IDs ──────────────────────────────────────────────
        if ids:
            campaign_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]

            if not campaign_ids:
                return CampaignsListResponse(campaigns=[], total=0, page=page, size=size)

            placeholders = ','.join(['?'] * len(campaign_ids))
            cursor.execute(f"""
                SELECT * FROM campaigns
                WHERE user_id = %s AND id IN ({placeholders})
                ORDER BY created_at DESC
            """, [user_id] + campaign_ids)

            campaigns = cursor.fetchall()
            total = len(campaigns)

        # ── Paginated fetch with optional search and sorting ───────────────────
        else:
            offset = (page - 1) * size

            # ── Build WHERE clause ─────────────────────────────────────────────
            where_clause = "c.user_id = %s"
            where_values = [user_id]

            if search and search.strip():
                where_clause += " AND c.name LIKE %s"
                where_values.append(f"%{search.strip()}%")

            # ── Build ORDER BY clause ──────────────────────────────────────────
            sort_direction = "DESC" if sort_order == "desc" else "ASC"
            
            # Determine which query to use based on sort_by
            if sort_by in ['companies', 'sent', 'read', 'scheduled']:
                # ── STATS-BASED SORTING: Need to aggregate from emails ────────
                
                # Map sort_by to aggregation column
                stats_column_map = {
                    'companies': 'COUNT(DISTINCT cc.company_id)',
                    'sent':      'SUM(CASE WHEN e.status = "sent" THEN 1 ELSE 0 END)',
                    'read':      'SUM(CASE WHEN e.read_at IS NOT NULL THEN 1 ELSE 0 END)',
                    'scheduled': 'SUM(CASE WHEN e.status = "scheduled" THEN 1 ELSE 0 END)',
                }
                
                stats_column = stats_column_map[sort_by]
                order_by_clause = f"{stats_column} {sort_direction}, c.id ASC"
                
                # Count query with aggregation
                count_query = f"""
                    SELECT COUNT(DISTINCT c.id) as total 
                    FROM campaigns c
                    WHERE {where_clause}
                """
                cursor.execute(count_query, where_values)
                total = cursor.fetchone()["total"]

                # Fetch query with LEFT JOINs to emails through campaign_company
                fetch_query = f"""
                    SELECT c.*
                    FROM campaigns c
                    LEFT JOIN campaign_company cc ON c.id = cc.campaign_id
                    LEFT JOIN emails e ON cc.id = e.campaign_company_id
                    WHERE {where_clause}
                    GROUP BY c.id
                    ORDER BY {order_by_clause}
                    LIMIT %s OFFSET %s
                """
                where_values.extend([size, offset])
                
            else:
                # ── SIMPLE COLUMN SORTING ──────────────────────────────────────
                if sort_by == 'name':
                    # Use LOWER() for case-insensitive alphabetical sort
                    order_by_clause = f"LOWER(c.name) {sort_direction}"
                else:
                    # Default: most recent first
                    order_by_clause = "c.created_at DESC"

                # Count query (simple)
                count_query = f"""
                    SELECT COUNT(*) as total 
                    FROM campaigns c
                    WHERE {where_clause}
                """
                cursor.execute(count_query, where_values)
                total = cursor.fetchone()["total"]

                # Fetch query (simple)
                fetch_query = f"""
                    SELECT c.* 
                    FROM campaigns c
                    WHERE {where_clause}
                    ORDER BY {order_by_clause}
                    LIMIT %s OFFSET %s
                """
                where_values.extend([size, offset])

            # ── Execute fetch query ────────────────────────────────────────────
            cursor.execute(fetch_query, where_values)
            campaigns = cursor.fetchall()

        campaign_list = [CampaignResponse(**dict(campaign)) for campaign in campaigns]

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
            placeholders = ','.join(['?'] * len(campaign_ids))
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