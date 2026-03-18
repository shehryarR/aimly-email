"""
Email Shared Models & Helpers
Pydantic models and utility functions shared between email.py and email_actions.py
"""

import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, validator
from tools.email_sender_tool import AttachmentInfo

# Get attachment storage path from environment
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
    time: Optional[str] = None  # ISO datetime string for scheduling

    @validator("time")
    def validate_time(cls, v):
        if v:
            try:
                dt = datetime.fromisoformat(v.replace('Z', '+00:00'))
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
    logo_data: Optional[str] = None  # base64 data URL — only accepted when inherit_campaign_branding = 0
    logo_clear: Optional[bool] = None  # set True to explicitly clear logo without uploading a new one
    time: Optional[str] = None
    html_email: Optional[bool] = None  # set True to mark email as HTML, False for plain text

class MessageResponse(BaseModel):
    message: str
    success: bool = True
    email_id: Optional[int] = None


# ==================================================================================
# Helper: resolve branding (signature + logo) based on inherit flags
# No fallback to defaults — returns None if not set at the chosen level.
# ==================================================================================
def resolve_branding(email_row, campaign_prefs, global_prefs, inherit_campaign_branding):
    """
    Resolve signature and logo according to the inheritance chain.

    inherit_campaign_branding = 0 → email's own fields only
    inherit_campaign_branding = 1:
        inherit_global_settings = 0 → campaign fields
        inherit_global_settings = 1 → global fields
    """
    if not inherit_campaign_branding:
        return (
            email_row["signature"] if email_row else None,
            email_row["logo"] if email_row else None,
            email_row["logo_mime_type"] if email_row else None,
        )

    inherit_global = (
        campaign_prefs["inherit_global_settings"]
        if campaign_prefs and campaign_prefs["inherit_global_settings"] is not None
        else 1
    )

    if not inherit_global:
        return (
            campaign_prefs["signature"] if campaign_prefs else None,
            campaign_prefs["logo"] if campaign_prefs else None,
            campaign_prefs["logo_mime_type"] if campaign_prefs else None,
        )

    return (
        global_prefs["signature"] if global_prefs else None,
        global_prefs["logo"] if global_prefs else None,
        global_prefs["logo_mime_type"] if global_prefs else None,
    )


# ==================================================================================
# Helper: resolve attachments for a PRIMARY email based on inherit flags
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
            WHERE ea.email_id = ?
        """, (email_id,))
        for att in cursor.fetchall():
            attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
        return list(attachment_set.values())

    if not inherit_global_attachments:
        cursor.execute("""
            SELECT a.id, a.name FROM attachments a
            JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
            JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
            WHERE cp.campaign_id = ?
        """, (campaign_id,))
        for att in cursor.fetchall():
            attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
        return list(attachment_set.values())

    # Global attachments only
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = ?
    """, (user_id,))
    for att in cursor.fetchall():
        attachment_set[att["id"]] = create_attachment_info(att["id"], att["name"])
    return list(attachment_set.values())


# ==================================================================================
# Helper: resolve attachment IDs for a PRIMARY email based on inherit flags
# Same logic as resolve_attachments_for_primary but returns IDs only
# ==================================================================================
def resolve_attachment_ids_for_primary(email_id, campaign_id, user_id, cursor,
                                       inherit_campaign_attachments, inherit_global_attachments):
    """
    Resolve attachment IDs for a primary email following the inheritance chain.

    inherit_campaign_attachments = 0 → email's own attachments only
    inherit_campaign_attachments = 1:
        inherit_global_attachments = 0 → campaign attachments only
        inherit_global_attachments = 1 → global attachments only
    """
    if not inherit_campaign_attachments:
        cursor.execute("""
            SELECT attachment_id FROM email_attachments WHERE email_id = ?
        """, (email_id,))
        return [row["attachment_id"] for row in cursor.fetchall()]

    if not inherit_global_attachments:
        cursor.execute("""
            SELECT a.id FROM attachments a
            JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
            JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
            WHERE cp.campaign_id = ?
        """, (campaign_id,))
        return [row["id"] for row in cursor.fetchall()]

    # Global attachments only
    cursor.execute("""
        SELECT a.id FROM attachments a
        JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = ?
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
        WHERE ea.email_id = ?
    """, (email_id,))
    return [create_attachment_info(att["id"], att["name"]) for att in cursor.fetchall()]


# ==================================================================================
# Helper: create AttachmentInfo object from attachment ID and filename
# ==================================================================================
def create_attachment_info(attachment_id: int, original_filename: str) -> AttachmentInfo:
    """
    Create an AttachmentInfo object for a single attachment.

    Args:
        attachment_id: Database ID of the attachment
        original_filename: Original filename from database

    Returns:
        AttachmentInfo with file_path = {storage_path}/{id}.{extension}
        and display_name = original_filename
    """
    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{attachment_id}{file_extension}"
    file_path = str(Path(ATTACHMENT_STORAGE_PATH) / saved_filename)

    return AttachmentInfo(
        file_path=file_path,
        display_name=original_filename
    )