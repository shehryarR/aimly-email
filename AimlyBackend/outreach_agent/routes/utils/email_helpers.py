"""
Email Shared Models & Helpers
Pydantic models and utility functions shared between email.py and email_actions.py.

resolve_branding UPDATED:
  signature and logo are now sourced from the brands table, not campaign_preferences
  or global_settings directly. Callers (email_actions.py, scheduler.py) resolve the
  brand dict before calling this function and pass it as `brand_prefs`.

  The `campaign_prefs` parameter is still used only for the inherit_global_settings
  flag to determine which level of branding to honour.

Inheritance chain for branding:
  inherit_campaign_branding = 0 → email's own fields only
  inherit_campaign_branding = 1:
    inherit_global_settings = 0 → campaign's linked brand
    inherit_global_settings = 1 → user's default brand
  (Both cases already resolved into `brand_prefs` by the caller.)
"""

import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, validator
from tools.email_sender_tool import AttachmentInfo

ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")


# ==================================================================================
# Pydantic Models
# ==================================================================================

class EmailResponse(BaseModel):
    id: int
    email_subject: Optional[str] = None
    email_content: str
    recipient_email: Optional[str] = None
    status: str
    timezone: str
    sent_at: Optional[str] = None

class EmailListResponse(BaseModel):
    emails: List[EmailResponse]
    total: int
    page: int
    size: int

class SendEmailRequest(BaseModel):
    time: Optional[str] = None

    @validator("time")
    def validate_time(cls, v):
        if v:
            try:
                dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt <= datetime.now(timezone.utc):
                    raise ValueError("Scheduled time must be in the future")
            except ValueError as e:
                raise ValueError("Invalid datetime format or time in past")
        return v

class EmailUpdateRequest(BaseModel):
    email_subject: Optional[str] = None
    email_content: Optional[str] = None
    recipient_email: Optional[str] = None
    status: Optional[str] = None
    timezone: Optional[str] = None
    signature: Optional[str] = None
    logo_data: Optional[str] = None
    logo_clear: Optional[bool] = None
    time: Optional[str] = None
    html_email: Optional[bool] = None

class MessageResponse(BaseModel):
    message: str
    success: bool = True
    email_id: Optional[int] = None

class BulkUpdateItem(BaseModel):
    email_id: int
    email_subject: Optional[str] = None
    email_content: Optional[str] = None
    recipient_email: Optional[str] = None
    status: Optional[str] = None
    timezone: Optional[str] = None
    signature: Optional[str] = None
    logo_data: Optional[str] = None
    logo_clear: Optional[bool] = None
    time: Optional[str] = None
    html_email: Optional[bool] = None

class BulkUpdateRequest(BaseModel):
    updates: List[BulkUpdateItem]

class BulkUpdateResponse(BaseModel):
    updated: int
    failed: int
    errors: List[dict]


# ==================================================================================
# Helper: resolve branding (signature + logo) based on inherit flags
#
# UPDATED: `brand_prefs` replaces the old `campaign_prefs` / `global_prefs`
# signature/logo fields. The caller (email_actions.py / scheduler.py) is
# responsible for resolving the correct brand row BEFORE calling this function:
#
#   - inherit_global_settings = 0 → fetch brand by campaign_preferences.brand_id
#   - inherit_global_settings = 1 → fetch user's default brand (is_default = 1)
#
# This function only needs to know:
#   - email_row:              the email's own stored branding (used when inherit=0)
#   - campaign_prefs:         used ONLY for the inherit_global_settings flag
#   - brand_prefs:            the resolved brand dict (signature, logo, logo_mime_type)
#   - inherit_campaign_branding: top-level flag from campaign_company
# ==================================================================================
def resolve_branding(email_row, campaign_prefs, brand_prefs, inherit_campaign_branding):
    """
    Resolve signature and logo according to the inheritance chain.

    inherit_campaign_branding = 0 → email's own fields only
    inherit_campaign_branding = 1 → use brand_prefs (already resolved by caller)
    """
    if not inherit_campaign_branding:
        return (
            email_row["signature"]     if email_row else None,
            email_row["logo"]          if email_row else None,
            email_row["logo_mime_type"] if email_row else None,
        )

    # Brand is pre-resolved by caller — use it directly
    return (
        brand_prefs["signature"]      if brand_prefs else None,
        brand_prefs["logo"]           if brand_prefs else None,
        brand_prefs["logo_mime_type"] if brand_prefs else None,
    )


# ==================================================================================
# Helper: resolve attachments for a PRIMARY email based on inherit flags
# (unchanged — attachment logic is independent of the brand migration)
# ==================================================================================
def resolve_attachments_for_primary(email_id, campaign_id, user_id, cursor,
                                    inherit_campaign_attachments, inherit_global_attachments):
    """
    Collect attachments for a primary email.

    inherit_campaign_attachments = 0 → email's own attachments only
    inherit_campaign_attachments = 1:
        inherit_global_attachments = 0 → campaign attachments only
        inherit_global_attachments = 1 → global attachments only
    """
    attachment_set = {}

    if not inherit_campaign_attachments:
        cursor.execute("""
            SELECT a.id, a.name FROM attachments a
            JOIN email_attachments ea ON a.id = ea.attachment_id
            WHERE ea.email_id = %s
        """, (email_id,))
        for att in cursor.fetchall():
            attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
        return list(attachment_set.values())

    if not inherit_global_attachments:
        cursor.execute("""
            SELECT a.id, a.name FROM attachments a
            JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
            JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
            WHERE cp.campaign_id = %s
        """, (campaign_id,))
        for att in cursor.fetchall():
            attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
        return list(attachment_set.values())

    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = %s
    """, (user_id,))
    for att in cursor.fetchall():
        attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
    return list(attachment_set.values())


# ==================================================================================
# Helper: resolve attachment IDs for a PRIMARY email based on inherit flags
# ==================================================================================
def resolve_attachment_ids_for_primary(email_id, campaign_id, user_id, cursor,
                                       inherit_campaign_attachments, inherit_global_attachments):
    """
    Resolve attachment IDs for a primary email following the inheritance chain.
    """
    if not inherit_campaign_attachments:
        cursor.execute(
            "SELECT attachment_id FROM email_attachments WHERE email_id = %s", (email_id,)
        )
        return [row["attachment_id"] for row in cursor.fetchall()]

    if not inherit_global_attachments:
        cursor.execute("""
            SELECT a.id FROM attachments a
            JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
            JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
            WHERE cp.campaign_id = %s
        """, (campaign_id,))
        return [row["id"] for row in cursor.fetchall()]

    cursor.execute("""
        SELECT a.id FROM attachments a
        JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = %s
    """, (user_id,))
    return [row["id"] for row in cursor.fetchall()]


# ==================================================================================
# Helper: collect own attachments only (for draft/scheduled/sent emails)
# ==================================================================================
def get_own_attachments(email_id, cursor) -> List[AttachmentInfo]:
    """Return only the email's own stored attachments — no inheritance."""
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN email_attachments ea ON a.id = ea.attachment_id
        WHERE ea.email_id = %s
    """, (email_id,))
    return [create_attachment_info(att["id"], att["name"]) for att in cursor.fetchall()]


# ==================================================================================
# Helper: create AttachmentInfo object from attachment ID and filename
# ==================================================================================
def create_attachment_info(attachment_id: int, original_filename: str) -> AttachmentInfo:
    """Create an AttachmentInfo object for a single attachment."""
    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{attachment_id}{file_extension}"
    file_path = str(Path(ATTACHMENT_STORAGE_PATH) / saved_filename)
    return AttachmentInfo(file_path=file_path, display_name=original_filename)