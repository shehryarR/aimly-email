from datetime import datetime
"""
Campaign-Company Relationship Routes
Handles many-to-many relationships between campaigns and companies
UPDATED: Added search functionality to GET endpoints
         Added inherit_campaign_attachments field support
         Added inherit_campaign_branding field support
         Added optedOut field to company response (checks microservice opt-out list)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
import os
import requests
from core.database.connection import get_connection
from routes.auth import get_current_user


def _is_opted_out(sender_email: str, receiver_email: str) -> bool:
    """
    Check the microservice opt-out list before sending.
    Returns True if the receiver has unsubscribed from this sender.
    Returns False if opted-in, microservice not configured, or on any error.
    """
    base_url = os.getenv("MICROSERVICE_BASE_URL")
    api_key  = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not api_key:
        return False
    try:
        resp = requests.get(
            f"{base_url}/optout/check",
            params={"sender_email": sender_email, "receiver_email": receiver_email},
            headers={"X-Api-Key": api_key},
            timeout=5,
        )
        if resp.status_code == 200:
            return not resp.json().get("should_send", True)
    except Exception as exc:
        print(f"[OptOut] Check failed — allowing send: {exc}")
    return False

campaign_company_router = APIRouter(tags=["Campaign-Company Relationships"])

# Pydantic Models
class CompanyResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    company_info: Optional[str] = None
    created_at: datetime
    optedOut: bool = False

class CampaignCompanyResponse(BaseModel):
    companies: List[CompanyResponse]
    total: int
    page: int
    size: int

class CampaignResponse(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime

class CompanyCampaignsResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int

class MessageResponse(BaseModel):
    message: str
    success: bool = True
    created: int = 0


# ==================================================================================
# GET /campaign/{campaign_id}/company - Get all companies in a campaign
# UPDATED: Added `search` query param - filters by name OR email (case-insensitive)
# ==================================================================================
@campaign_company_router.get("/campaign/{campaign_id}/company/", response_model=CampaignCompanyResponse)
def get_campaign_companies(
    campaign_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1),
    search: Optional[str] = Query(None, description="Search by company name or email (case-insensitive)"),
    sort_by: Optional[str] = Query(None, description="Sort field: name | created_at"),
    sort_order: Optional[str] = Query("asc", description="Sort direction: asc | desc"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all companies associated with a specific campaign.
    
    Features:
    - Pagination via page and size
    - Optional search by company name or email (case-insensitive)
    - Returns total count reflecting filtered results
    
    Args:
        campaign_id: ID of the campaign
        page: Page number (default 1)
        size: Items per page (default 10, max 100)
        search: Optional search term to filter by name or email
    
    Returns:
        CampaignCompanyResponse with paginated companies and total count
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Verify campaign exists ──────────────────────────────────────────────
        cursor.execute("""
            SELECT id FROM campaigns WHERE id = %s AND user_id = %s
        """, (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # ── Sort logic ─────────────────────────────────────────────────────────
        valid_sort = {"name", "created_at"}
        if sort_by not in valid_sort:
            sort_by = None
        sort_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"

        if sort_by == "name":
            order_clause = f"ORDER BY LOWER(c.name) {sort_dir}"
        elif sort_by == "created_at":
            order_clause = f"ORDER BY c.created_at {sort_dir}"
        else:
            order_clause = "ORDER BY cc.created_at DESC"

        # ── Get total count (with optional search filter) ──────────────────────
        offset = (page - 1) * size

        if search and search.strip():
            pattern = f"%{search.strip()}%"
            
            cursor.execute("""
                SELECT COUNT(*) as total 
                FROM campaign_company cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.campaign_id = %s AND c.user_id = %s
                  AND (c.name LIKE %s OR c.email LIKE %s)
            """, (campaign_id, user_id, pattern, pattern))
            total = cursor.fetchone()["total"]

            cursor.execute(f"""
                SELECT c.* 
                FROM campaign_company cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.campaign_id = %s AND c.user_id = %s
                  AND (c.name LIKE %s OR c.email LIKE %s)
                {order_clause}
                LIMIT %s OFFSET %s
            """, (campaign_id, user_id, pattern, pattern, size, offset))
        else:
            cursor.execute("""
                SELECT COUNT(*) as total 
                FROM campaign_company cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.campaign_id = %s AND c.user_id = %s
            """, (campaign_id, user_id))
            total = cursor.fetchone()["total"]

            cursor.execute(f"""
                SELECT c.* 
                FROM campaign_company cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.campaign_id = %s AND c.user_id = %s
                {order_clause}
                LIMIT %s OFFSET %s
            """, (campaign_id, user_id, size, offset))

        companies = cursor.fetchall()

        # ── Fetch sender email from SMTP credentials for opt-out checks ─────────
        cursor.execute("""
            SELECT email_address FROM user_keys WHERE user_id = %s
        """, (user_id,))
        smtp_row = cursor.fetchone()
        sender_email = smtp_row["email_address"] if smtp_row and smtp_row["email_address"] else None

        # ── Build company list with optedOut flag ──────────────────────────────
        company_list = []
        for company in companies:
            d = dict(company)
            if sender_email:
                d["optedOut"] = _is_opted_out(sender_email, d["email"])
            else:
                d["optedOut"] = False
            company_list.append(CompanyResponse(**d))

    return CampaignCompanyResponse(
        companies=company_list,
        total=total,
        page=page,
        size=size
    )


# ==================================================================================
# POST /campaign/{campaign_id}/company - Add companies to a campaign
# ==================================================================================
@campaign_company_router.post("/campaign/{campaign_id}/company/", response_model=MessageResponse)
def add_companies_to_campaign(
    campaign_id: int,
    company_ids: List[int],
    current_user: dict = Depends(get_current_user)
):
    """
    Add existing companies to a campaign by their IDs.
    
    This endpoint assumes companies already exist in the database.
    A primary email row is automatically created for every new campaign_company link.
    inherit_campaign_attachments and inherit_campaign_branding both default to 1.
    
    Args:
        campaign_id: ID of the campaign to add companies to
        company_ids: List of company IDs to add to the campaign
    
    Returns:
        Message with count of successfully added companies
    """
    user_id = current_user["user_id"]
    created_count = 0

    if not company_ids:
        raise HTTPException(status_code=400, detail="No company IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify campaign exists and belongs to user
        cursor.execute("""
            SELECT id FROM campaigns WHERE id = %s AND user_id = %s
        """, (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        try:
            for company_id in company_ids:
                # Verify company exists and belongs to user
                cursor.execute("""
                    SELECT id FROM companies WHERE id = %s AND user_id = %s
                """, (company_id, user_id))

                if not cursor.fetchone():
                    continue  # Skip companies that don't exist or don't belong to user

                # Check if relationship already exists
                cursor.execute("""
                    SELECT id FROM campaign_company
                    WHERE campaign_id = %s AND company_id = %s
                """, (campaign_id, company_id))

                if cursor.fetchone():
                    continue  # Skip if already linked

                # Create the relationship
                cursor.execute("""
                    INSERT INTO campaign_company (campaign_id, company_id, inherit_campaign_attachments, inherit_campaign_branding)
                    VALUES (%s, %s, 1, 1)
                """, (campaign_id, company_id))
                
                cc_id = cursor.lastrowid
                
                # Create primary email for this relationship
                cursor.execute("""
                    INSERT INTO emails (campaign_company_id, email_content, status)
                    VALUES (%s, '', 'primary')
                """, (cc_id,))
                
                created_count += 1

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to add companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully added {created_count} companies to campaign",
        success=True,
        created=created_count
    )
# ==================================================================================
# POST /campaign/{campaign_id}/company/inherit/ - Get inherit flags for multiple companies
# ==================================================================================
class BulkInheritRequest(BaseModel):
    company_ids: List[int]

@campaign_company_router.post("/campaign/{campaign_id}/company/inherit/")
def get_bulk_inherit_flags(
    campaign_id: int,
    request: BulkInheritRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get inherit_campaign_attachments and inherit_campaign_branding for multiple
    companies in a campaign in a single query.

    Returns a dict keyed by company_id.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")

    with get_connection() as conn:
        cursor = conn.cursor()

        placeholders = ",".join(["%s"] * len(request.company_ids))
        cursor.execute(f"""
            SELECT cc.company_id, cc.inherit_campaign_attachments, cc.inherit_campaign_branding
            FROM campaign_company cc
            JOIN campaigns camp ON cc.campaign_id = camp.id
            JOIN companies comp ON cc.company_id = comp.id
            WHERE cc.campaign_id = %s AND cc.company_id IN ({placeholders})
              AND camp.user_id = %s AND comp.user_id = %s
        """, [campaign_id] + request.company_ids + [user_id, user_id])

        rows = cursor.fetchall()

    return {
        row["company_id"]: {
            "inherit_campaign_attachments": row["inherit_campaign_attachments"],
            "inherit_campaign_branding": row["inherit_campaign_branding"],
        }
        for row in rows
    }


# PUT /campaign/{campaign_id}/company/inherit/bulk/ - Bulk update inherit flags
# ==================================================================================
class BulkInheritUpdateItem(BaseModel):
    company_id: int
    inherit_campaign_attachments: int
    inherit_campaign_branding: int

class BulkInheritUpdateRequest(BaseModel):
    updates: List[BulkInheritUpdateItem]

@campaign_company_router.put("/campaign/{campaign_id}/company/inherit/bulk/")
def bulk_update_inherit_flags(
    campaign_id: int,
    request: BulkInheritUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update inherit_campaign_attachments and inherit_campaign_branding
    for multiple companies in a campaign in a single call.
    Skips failures with logged errors and returns a summary.
    """
    user_id = current_user["user_id"]

    if not request.updates:
        raise HTTPException(status_code=400, detail="updates must not be empty")

    updated = 0
    errors = []

    for item in request.updates:
        if item.inherit_campaign_attachments not in (0, 1):
            errors.append({"company_id": item.company_id, "reason": "inherit_campaign_attachments must be 0 or 1"})
            continue
        if item.inherit_campaign_branding not in (0, 1):
            errors.append({"company_id": item.company_id, "reason": "inherit_campaign_branding must be 0 or 1"})
            continue

        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT cc.id FROM campaign_company cc
                    JOIN campaigns camp ON cc.campaign_id = camp.id
                    JOIN companies comp ON cc.company_id = comp.id
                    WHERE cc.campaign_id = %s AND cc.company_id = %s
                      AND camp.user_id = %s AND comp.user_id = %s
                """, (campaign_id, item.company_id, user_id, user_id))

                row = cursor.fetchone()
                if not row:
                    errors.append({"company_id": item.company_id, "reason": "Campaign-company relationship not found"})
                    continue

                cursor.execute("""
                    UPDATE campaign_company
                    SET inherit_campaign_attachments = %s,
                        inherit_campaign_branding = %s
                    WHERE id = %s
                """, (item.inherit_campaign_attachments, item.inherit_campaign_branding, row["id"]))
                conn.commit()
                updated += 1

        except Exception as e:
            errors.append({"company_id": item.company_id, "reason": str(e)})

    return {"updated": updated, "failed": len(errors), "errors": errors}


# DELETE /campaign/{campaign_id}/company - Remove companies from campaign
# ==================================================================================
@campaign_company_router.delete("/campaign/{campaign_id}/company/", response_model=MessageResponse)
def remove_companies_from_campaign(
    campaign_id: int,
    ids: str = Query(..., description="Comma-separated company IDs"),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete companies from a specific campaign by company IDs.
    Only removes relationships, does not delete the companies themselves.
    """
    user_id = current_user["user_id"]
    company_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]

    if not company_ids:
        raise HTTPException(status_code=400, detail="No valid company IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id FROM campaigns WHERE id = %s AND user_id = %s
        """, (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        try:
            placeholders = ','.join(['%s'] * len(company_ids))
            cursor.execute(f"""
                DELETE FROM campaign_company
                WHERE campaign_id = %s AND company_id IN ({placeholders})
            """, [campaign_id] + company_ids)

            removed_count = cursor.rowcount
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to remove companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully removed {removed_count} companies from campaign",
        success=True
    )


# ==================================================================================
# GET /company/{company_id}/campaign - Get all campaigns for a company
# UPDATED: Added `search` query param - filters by campaign name (case-insensitive)
# ==================================================================================
@campaign_company_router.get("/company/{company_id}/campaign/", response_model=CompanyCampaignsResponse)
def get_company_campaigns(
    company_id: int,
    search: Optional[str] = Query(None, description="Search by campaign name (case-insensitive)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all campaigns that a specific company is part of.
    
    Features:
    - Optional search by campaign name (case-insensitive)
    - Returns total count reflecting filtered results
    
    Args:
        company_id: ID of the company
        search: Optional search term to filter by campaign name
    
    Returns:
        CompanyCampaignsResponse with campaigns and total count
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Verify company exists ───────────────────────────────────────────────
        cursor.execute("""
            SELECT id FROM companies WHERE id = %s AND user_id = %s
        """, (company_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Company not found")

        # ── Fetch campaigns with optional search filter ──────────────────────────
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            
            cursor.execute("""
                SELECT c.* 
                FROM campaign_company cc
                JOIN campaigns c ON cc.campaign_id = c.id
                WHERE cc.company_id = %s AND c.user_id = %s
                  AND c.name LIKE %s
                ORDER BY cc.created_at DESC
            """, (company_id, user_id, pattern))
        else:
            cursor.execute("""
                SELECT c.* 
                FROM campaign_company cc
                JOIN campaigns c ON cc.campaign_id = c.id
                WHERE cc.company_id = %s AND c.user_id = %s
                ORDER BY cc.created_at DESC
            """, (company_id, user_id))

        campaigns = cursor.fetchall()
        campaign_list = [CampaignResponse(**dict(campaign)) for campaign in campaigns]

    return CompanyCampaignsResponse(
        campaigns=campaign_list,
        total=len(campaign_list)
    )