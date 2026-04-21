"""
Email Shared Models & Helpers
Pydantic models and utility functions shared between email.py and email_actions.py.

BRANDING:
  resolve_branding() has been REMOVED.
  Branding (signature + logo) is always sourced from the campaign's linked brand
  (or the user's default brand). Callers resolve the brand row directly and bake
  the fields into the email row at send/draft/schedule time.
  There are no per-email or per-company branding overrides.

ATTACHMENT INHERITANCE (additive / hierarchical):
  All three resolution functions now use an ADDITIVE model:

    Layer 1 — email's own attachments         (always included)
    Layer 2 — campaign attachments            (added if inherit_campaign_attachments = 1)
    Layer 3 — global settings attachments    (added if inherit_campaign_attachments = 1
                                               AND inherit_global_attachments = 1)

  Duplicates are deduplicated; order is email → campaign → global.
"""

import os
from pathlib import Path
from typing import List, Optional, Set
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
# Helper: resolve attachments for a PRIMARY email (additive / hierarchical)
#
# Returns a list of AttachmentInfo objects ready for the email sender tool.
# ==================================================================================
def resolve_attachments_for_primary(
    email_id: int,
    campaign_id: int,
    user_id: int,
    cursor,
    inherit_campaign_attachments: int,
    inherit_global_attachments: int,
) -> List[AttachmentInfo]:
    """
    Collect AttachmentInfo objects for a primary email using the additive model.

    Layer 1 — email's own attachments (always included).
    Layer 2 — campaign preference attachments (if inherit_campaign_attachments = 1).
    Layer 3 — global settings attachments    (if both inherit flags = 1).
    """
    seen: Set[int] = set()
    result: List[AttachmentInfo] = []

    def _add(rows):
        for att in rows:
            if att["id"] not in seen:
                seen.add(att["id"])
                info = create_attachment_info(att["id"], att["name"])
                if info is not None:
                    result.append(info)

    # Layer 1: email's own attachments
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN email_attachments ea ON a.id = ea.attachment_id
        WHERE ea.email_id = %s
    """, (email_id,))
    _add(cursor.fetchall())

    if not inherit_campaign_attachments:
        return result

    # Layer 2: campaign preference attachments
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN campaign_preference_attachments cpa ON a.id = cpa.attachment_id
        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
        WHERE cp.campaign_id = %s
    """, (campaign_id,))
    _add(cursor.fetchall())

    if not inherit_global_attachments:
        return result

    # Layer 3: global settings attachments
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN global_settings_attachments gsa ON a.id = gsa.attachment_id
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = %s
    """, (user_id,))
    _add(cursor.fetchall())

    return result


# ==================================================================================
# Helper: resolve attachment IDs for a PRIMARY email (additive / hierarchical)
#
# Same logic as above but returns plain IDs for baking into email_attachments rows.
# ==================================================================================
def resolve_attachment_ids_for_primary(
    email_id: int,
    campaign_id: int,
    user_id: int,
    cursor,
    inherit_campaign_attachments: int,
    inherit_global_attachments: int,
) -> List[int]:
    """
    Resolve the deduplicated list of attachment IDs for a primary email.

    Layer 1 — email's own attachments (always included).
    Layer 2 — campaign preference attachments (if inherit_campaign_attachments = 1).
    Layer 3 — global settings attachments    (if both inherit flags = 1).
    """
    seen: Set[int] = set()
    ordered: List[int] = []

    def _add(ids):
        for aid in ids:
            if aid not in seen:
                seen.add(aid)
                ordered.append(aid)

    # Layer 1: email's own attachments
    cursor.execute(
        "SELECT attachment_id FROM email_attachments WHERE email_id = %s ORDER BY attachment_id",
        (email_id,)
    )
    _add(row["attachment_id"] for row in cursor.fetchall())

    if not inherit_campaign_attachments:
        return ordered

    # Layer 2: campaign preference attachments
    cursor.execute("""
        SELECT cpa.attachment_id
        FROM campaign_preference_attachments cpa
        JOIN campaign_preferences cp ON cpa.campaign_preference_id = cp.id
        WHERE cp.campaign_id = %s
        ORDER BY cpa.attachment_id
    """, (campaign_id,))
    _add(row["attachment_id"] for row in cursor.fetchall())

    if not inherit_global_attachments:
        return ordered

    # Layer 3: global settings attachments
    cursor.execute("""
        SELECT gsa.attachment_id
        FROM global_settings_attachments gsa
        JOIN global_settings gs ON gsa.global_settings_id = gs.id
        WHERE gs.user_id = %s
        ORDER BY gsa.attachment_id
    """, (user_id,))
    _add(row["attachment_id"] for row in cursor.fetchall())

    return ordered


# ==================================================================================
# Helper: collect own attachments only (for draft / scheduled / sent emails)
# ==================================================================================
def get_own_attachments(email_id: int, cursor) -> List[AttachmentInfo]:
    """Return only the email's own stored attachments — no inheritance."""
    cursor.execute("""
        SELECT a.id, a.name FROM attachments a
        JOIN email_attachments ea ON a.id = ea.attachment_id
        WHERE ea.email_id = %s
    """, (email_id,))
    result = []
    for att in cursor.fetchall():
        info = create_attachment_info(att["id"], att["name"])
        if info is not None:
            result.append(info)
    return result


# ==================================================================================
# Helper: build an AttachmentInfo from an attachment ID and original filename.
# Returns None if the file does not exist on disk (skips missing files silently).
# ==================================================================================
def create_attachment_info(attachment_id: int, original_filename: str) -> Optional[AttachmentInfo]:
    """Create an AttachmentInfo for a single attachment. Returns None if missing on disk."""
    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{attachment_id}{file_extension}"
    file_path = Path(ATTACHMENT_STORAGE_PATH) / saved_filename
    if not file_path.exists():
        return None
    return AttachmentInfo(file_path=str(file_path), display_name=original_filename)