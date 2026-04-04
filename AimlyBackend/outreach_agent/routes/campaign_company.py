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



# ==================================================================================
# POST /campaign/bulk-enroll/ - Enroll companies into multiple campaigns at once
# ==================================================================================
class BulkEnrollRequest(BaseModel):
    company_ids: List[int]
    campaign_ids: List[int]

@campaign_company_router.post("/campaign/bulk-enroll/", response_model=MessageResponse)
def bulk_enroll_companies(
    request: BulkEnrollRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Enroll one or more companies into multiple campaigns in a single call.
    Companies already in a campaign are silently skipped.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")
    if not request.campaign_ids:
        raise HTTPException(status_code=400, detail="campaign_ids must not be empty")

    total_added = 0
    errors = []

    for campaign_id in request.campaign_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
                    (campaign_id, user_id)
                )
                if not cursor.fetchone():
                    errors.append({"campaign_id": campaign_id, "reason": "Campaign not found"})
                    continue

                for company_id in request.company_ids:
                    cursor.execute(
                        "SELECT id FROM companies WHERE id = %s AND user_id = %s",
                        (company_id, user_id)
                    )
                    if not cursor.fetchone():
                        continue

                    cursor.execute("""
                        SELECT id FROM campaign_company
                        WHERE campaign_id = %s AND company_id = %s
                    """, (campaign_id, company_id))
                    if cursor.fetchone():
                        continue

                    cursor.execute("""
                        INSERT INTO campaign_company (campaign_id, company_id)
                        VALUES (%s, %s)
                    """, (campaign_id, company_id))
                    new_cc_id = cursor.lastrowid

                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status)
                        SELECT %s, '', '', email, 'primary'
                        FROM companies WHERE id = %s
                    """, (new_cc_id, company_id))

                    total_added += 1

                conn.commit()

        except Exception as e:
            errors.append({"campaign_id": campaign_id, "reason": str(e)})
            continue

    return MessageResponse(
        message=f"Enrolled {total_added} company-campaign links" + (f", {len(errors)} campaigns failed" if errors else ""),
        success=len(errors) == 0
    )


# ==================================================================================
# POST /campaign/bulk-unenroll/ - Remove companies from multiple campaigns at once
# ==================================================================================
class BulkUnenrollRequest(BaseModel):
    company_ids: List[int]
    campaign_ids: List[int]

@campaign_company_router.post("/campaign/bulk-unenroll/", response_model=MessageResponse)
def bulk_unenroll_companies(
    request: BulkUnenrollRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove one or more companies from multiple campaigns in a single call.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")
    if not request.campaign_ids:
        raise HTTPException(status_code=400, detail="campaign_ids must not be empty")

    total_removed = 0
    errors = []

    for campaign_id in request.campaign_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
                    (campaign_id, user_id)
                )
                if not cursor.fetchone():
                    errors.append({"campaign_id": campaign_id, "reason": "Campaign not found"})
                    continue

                ph = ",".join(["%s"] * len(request.company_ids))
                cursor.execute(f"""
                    DELETE FROM campaign_company
                    WHERE campaign_id = %s AND company_id IN ({ph})
                """, [campaign_id] + request.company_ids)
                total_removed += cursor.rowcount
                conn.commit()

        except Exception as e:
            errors.append({"campaign_id": campaign_id, "reason": str(e)})
            continue

    return MessageResponse(
        message=f"Removed {total_removed} company-campaign links" + (f", {len(errors)} campaigns failed" if errors else ""),
        success=len(errors) == 0
    )