"""
Email Actions Routes — Generation, Sending & Drafting
Handles email operations with side effects: LLM generation, SMTP sending, scheduling, and draft creation.

INHERITANCE RULES:
══════════════════════════════════════════════════════════════════════

GENERATING PERSONALIZED EMAIL (LLM mode):
  inherit_global_settings = 1 → use global settings fields, fallback to default
  inherit_global_settings = 0 → use campaign fields, fallback to default

SENDING/DRAFTING/SCHEDULING PRIMARY EMAIL:
  Branding: always resolved from campaign's linked brand (or user's default brand).
            No per-email or per-company branding overrides — brand is set at campaign level.

  Attachments (additive/hierarchical):
    email's own attachments
    + if inherit_campaign_attachments = 1: campaign attachments added on top
      + if campaign.inherit_global_attachments = 1: global attachments added on top
  New email entry is created with the final resolved branding + attachments baked in.

SENDING/DRAFTING/SCHEDULING A DRAFT or SCHEDULED EMAIL:
  Use the email's own stored branding and attachments only.

DRAFTING A SENT or SCHEDULED EMAIL:
  Use the email's own stored branding and attachments only.

SMTP CREDENTIAL RESOLUTION:
  campaign_preferences.brand_id → brands table (decrypt email_password)
  ↓ if brand_id is NULL
  user's default brand (WHERE user_id = X AND is_default = 1)
  ↓ if no default brand
  raise error: "No brand configured for this campaign"
"""

import asyncio
import os
import re
import requests
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from core.database.connection import get_connection
from routes.auth import get_current_user
from routes.utils.crypto import _read_cookie_key, _LLM_COOKIE, decrypt_smtp_password
from services.email_service import (
    generate_email as svc_generate_email,
    send_email as svc_send_email,
)
from .utils.email_helpers import (
    MessageResponse,
    resolve_attachments_for_primary,
    resolve_attachment_ids_for_primary,
    get_own_attachments,
)
from tools.email_sender_tool import AttachmentInfo

_LLM_MODEL_COOKIE  = "llm_model_enc"
_DEFAULT_LLM_MODEL = "gemini-2.5-flash"

ATTACHMENT_STORAGE_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "./data/uploads/attachments")

email_actions_router = APIRouter(prefix="/email", tags=["Email Actions"])


# =============================================================================
# INLINE IMAGE HELPER
# =============================================================================

def _resolve_inline_image_attachments(
    email_content: str,
    user_id: int,
) -> List[AttachmentInfo]:
    """
    Scan email_content for {{filename}} placeholders and return AttachmentInfo
    objects for any that are image files belonging to this user.
    """
    from pathlib import Path

    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

    placeholders = re.findall(r'\{\{([^}]+)\}\}', email_content)
    print(f"[InlineImg] Placeholders in content: {placeholders}")

    if not placeholders:
        return []

    image_placeholders = [
        p.strip() for p in placeholders
        if Path(p.strip()).suffix.lower() in IMAGE_EXTENSIONS
    ]
    print(f"[InlineImg] Image placeholders to resolve: {image_placeholders}")

    if not image_placeholders:
        return []

    extra_attachments = []
    with get_connection() as conn:
        cursor = conn.cursor()
        for filename in image_placeholders:
            cursor.execute(
                "SELECT id, name FROM attachments WHERE user_id = %s AND name = %s",
                (user_id, filename),
            )
            row = cursor.fetchone()
            if not row:
                print(f"[InlineImg]   '{filename}' not found in DB for user {user_id}")
                continue

            ext = Path(filename).suffix.lower()
            file_path = Path(ATTACHMENT_STORAGE_PATH) / f"{row['id']}{ext}"
            print(f"[InlineImg]   '{filename}' → {file_path} exists={file_path.exists()}")

            if not file_path.exists():
                print(f"[InlineImg]   SKIP — not on disk")
                continue

            extra_attachments.append(AttachmentInfo(
                file_path=str(file_path),
                display_name=filename,
            ))
            print(f"[InlineImg]   QUEUED for inline replacement")

    return extra_attachments


# =============================================================================
# SMTP CREDENTIAL RESOLUTION HELPER
# Resolves brand SMTP credentials for a given campaign.
# Falls back to the user's default brand if no brand_id is set on the campaign.
# =============================================================================

def _resolve_smtp_for_campaign(campaign_id: int, user_id: int, cursor) -> dict:
    """
    Resolve SMTP credentials from the brands table for a campaign.

    Resolution:
      1. campaign_preferences.brand_id → brand row
      2. Fallback: user's default brand (is_default = 1)
      3. Raises HTTP 400 if neither found.

    Returns a dict with: sender_email, sender_password (decrypted), smtp_host, smtp_port.
    """
    cursor.execute("""
        SELECT b.id, b.smtp_host, b.smtp_port, b.email_address, b.email_password
        FROM brands b
        JOIN campaign_preferences cp ON cp.brand_id = b.id
        WHERE cp.campaign_id = %s
    """, (campaign_id,))
    brand_row = cursor.fetchone()

    if not brand_row:
        # Fallback to user's default brand
        cursor.execute("""
            SELECT id, smtp_host, smtp_port, email_address, email_password
            FROM brands WHERE user_id = %s AND is_default = 1
            LIMIT 1
        """, (user_id,))
        brand_row = cursor.fetchone()

    if not brand_row or not brand_row["email_address"] or not brand_row["email_password"]:
        raise HTTPException(
            status_code=400,
            detail="No brand configured for this campaign. Please assign a brand or set a default brand in Settings.",
        )

    try:
        decrypted_pw = decrypt_smtp_password(brand_row["email_password"])
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to decrypt SMTP credentials. Please re-save your brand's email password.",
        )

    return {
        "sender_email":    brand_row["email_address"],
        "sender_password": decrypted_pw,
        "smtp_host":       brand_row["smtp_host"] or "smtp.gmail.com",
        "smtp_port":       brand_row["smtp_port"] or 587,
    }


# =============================================================================
# OPT-OUT HELPER
# =============================================================================

def _is_opted_out(sender_email: str, receiver_email: str) -> bool:
    """
    Check the microservice opt-out list before sending.
    Returns True if the receiver has unsubscribed from this sender.
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


# ==================================================================================
# POST /email/campaign/{campaign_id}/bulk-generate
# ==================================================================================

class BulkGenerateRequest(BaseModel):
    company_ids: List[int]
    query_type: str = "plain"   # plain | html | template
    force: bool = True

class BulkGenerateResponse(BaseModel):
    generated: int
    failed: int
    errors: List[dict]

@email_actions_router.post("/campaign/{campaign_id}/bulk-generate/", response_model=BulkGenerateResponse)
def bulk_generate_emails(
    campaign_id: int,
    request: BulkGenerateRequest,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Generate emails for multiple companies in a campaign."""
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")

    query_type = request.query_type
    force      = request.force

    if query_type not in ("plain", "html", "template"):
        raise HTTPException(status_code=400, detail="query_type must be 'plain', 'html', or 'template'")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM campaigns WHERE id = %s AND user_id = %s", (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

    # ── Load shared config once ───────────────────────────────────────────────
    llm_config               = None
    shared_prefs             = None
    global_prefs             = None
    inherit_global_settings  = 1
    template_email           = None
    template_html_email_flag = 0

    if query_type in ("plain", "html"):
        llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)
        if not llm_api_key:
            raise HTTPException(
                status_code=400,
                detail="No LLM API key configured. Please add one in Settings.",
            )

        llm_model = _read_cookie_key(http_request, _LLM_MODEL_COOKIE) or _DEFAULT_LLM_MODEL
        llm_config = {
            "api_key": llm_api_key,
            "model":   llm_model,
        }

        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT goal, value_prop, tone, cta,
                       writing_guidelines, additional_notes, inherit_global_settings
                FROM campaign_preferences WHERE campaign_id = %s
            """, (campaign_id,))
            shared_prefs = cursor.fetchone()

            inherit_global_settings = (
                shared_prefs["inherit_global_settings"]
                if shared_prefs and shared_prefs["inherit_global_settings"] is not None
                else 1
            )

            if inherit_global_settings:
                cursor.execute("""
                    SELECT goal, value_prop, tone, cta, writing_guidelines, additional_notes
                    FROM global_settings WHERE user_id = %s
                """, (user_id,))
                global_prefs = cursor.fetchone()

    else:  # template
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT template_email, template_html_email
                FROM campaign_preferences WHERE campaign_id = %s
            """, (campaign_id,))
            template_row = cursor.fetchone()
            if not template_row or not template_row["template_email"]:
                raise HTTPException(
                    status_code=400,
                    detail="No email template found for this campaign. Please generate one first.",
                )
            template_email           = template_row["template_email"]
            template_html_email_flag = int(template_row["template_html_email"]) if template_row["template_html_email"] is not None else 0

    PREF_DEFAULTS = {
        "goal":               "Generate leads and start a conversation",
        "value_prop":         "We provide high-quality solutions tailored to your needs",
        "cta":                "Schedule a quick call to learn more",
        "tone":               "Professional",
        "writing_guidelines": None,
        "additional_notes":   None,
    }

    def get_pref_with_default(field):
        if inherit_global_settings:
            val = global_prefs[field] if global_prefs else None
        else:
            val = shared_prefs[field] if shared_prefs else None
        return val if val is not None else PREF_DEFAULTS.get(field)

    # ── Per-company loop ──────────────────────────────────────────────────────
    generated_count = 0
    errors: List[dict] = []

    for company_id in request.company_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT * FROM companies WHERE id = %s AND user_id = %s",
                    (company_id, user_id)
                )
                company = cursor.fetchone()
                if not company:
                    errors.append({"company_id": company_id, "reason": "Company not found"})
                    continue

                cursor.execute("""
                    SELECT id FROM campaign_company
                    WHERE campaign_id = %s AND company_id = %s
                """, (campaign_id, company_id))
                cc_row = cursor.fetchone()
                if not cc_row:
                    errors.append({"company_id": company_id, "reason": "Company not associated with this campaign"})
                    continue

                cc_id         = cc_row["id"]
                company_name  = company["name"]
                company_email = company["email"]

            if query_type in ("plain", "html"):
                if not force:
                    with get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT id, email_content, html_email FROM emails
                            WHERE campaign_company_id = %s AND status = 'primary'
                        """, (cc_id,))
                        existing = cursor.fetchone()
                    if existing and existing["email_content"] and existing["email_content"].strip():
                        if bool(existing["html_email"]) == (query_type == "html"):
                            generated_count += 1
                            continue

                context_parts = []
                for field in ("goal", "value_prop", "cta", "tone", "writing_guidelines", "additional_notes"):
                    val = get_pref_with_default(field)
                    if val:
                        label = {
                            "goal":               "Goal",
                            "value_prop":         "Value Proposition",
                            "cta":                "Call to Action",
                            "tone":               "Tone",
                            "writing_guidelines": "Writing Guidelines",
                            "additional_notes":   "Additional Context",
                        }[field]
                        context_parts.append(f"{label}: {val}")

                user_instruction = (
                    "\n".join(context_parts)
                    or f"Write a professional outreach email to {company_name}."
                )
                company_details = company["company_info"] or None

                loop = asyncio.new_event_loop()
                email_result, _ = loop.run_until_complete(
                    svc_generate_email(
                        company_name=company_name,
                        user_instruction=user_instruction,
                        llm_config=llm_config,
                        company_details=company_details,
                        html_email=(query_type == "html"),
                    )
                )
                loop.close()

                subject = email_result.get("subject") or f"Reaching out to {company_name}"
                body    = email_result.get("content") or ""
                if not body:
                    errors.append({"company_id": company_id, "reason": "LLM returned empty content"})
                    continue

                html_email_flag = 1 if query_type == "html" else 0

            else:  # template
                content = template_email.replace("{{company_name}}", company_name)
                if content.startswith("SUBJECT:"):
                    lines   = content.split("\n", 1)
                    subject = lines[0].replace("SUBJECT:", "").strip()
                    body    = lines[1].strip() if len(lines) > 1 else ""
                else:
                    subject = f"Reaching out to {company_name}"
                    body    = content
                html_email_flag = template_html_email_flag

            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id FROM emails
                    WHERE campaign_company_id = %s AND status = 'primary'
                """, (cc_id,))
                primary = cursor.fetchone()

                if primary:
                    cursor.execute("""
                        UPDATE emails
                        SET email_subject = %s, email_content = %s,
                            recipient_email = %s, html_email = %s
                        WHERE id = %s
                    """, (subject, body, company_email, html_email_flag, primary["id"]))
                else:
                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status, html_email)
                        VALUES (%s, %s, %s, %s, 'primary', %s)
                    """, (cc_id, subject, body, company_email, html_email_flag))
                conn.commit()

            generated_count += 1

        except Exception as e:
            print(f"[BulkGenerate] company_id={company_id} failed: {e}")
            errors.append({"company_id": company_id, "reason": str(e)})
            continue

    return BulkGenerateResponse(
        generated=generated_count,
        failed=len(errors),
        errors=errors,
    )


# ==================================================================================
# POST /email/bulk-send/ - Send or schedule multiple emails
# ==================================================================================

class BulkSendRequest(BaseModel):
    email_ids: List[int]
    time: Optional[str] = None

class BulkSendResponse(BaseModel):
    sent: int
    failed: int
    errors: List[dict]

@email_actions_router.post("/bulk-send/", response_model=BulkSendResponse)
def bulk_send_emails(
    request: BulkSendRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send or schedule multiple emails. SMTP credentials resolved per-email from brands."""
    user_id = current_user["user_id"]

    if not request.email_ids:
        raise HTTPException(status_code=400, detail="email_ids must not be empty")

    scheduled_at = None
    if request.time:
        try:
            scheduled_at = datetime.fromisoformat(request.time.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use ISO 8601.")

    sent_count = 0
    errors: List[dict] = []

    for email_id in request.email_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT e.*, cc.campaign_id, c.user_id
                    FROM emails e
                    JOIN campaign_company cc ON e.campaign_company_id = cc.id
                    JOIN campaigns c ON cc.campaign_id = c.id
                    WHERE e.id = %s AND c.user_id = %s
                """, (email_id, user_id))
                email = cursor.fetchone()

                if not email:
                    errors.append({"email_id": email_id, "reason": "Email not found"})
                    continue

                status = email["status"]

                if status not in ("primary", "draft", "scheduled", "failed"):
                    errors.append({"email_id": email_id, "reason": f"Cannot send email with status '{status}'"})
                    continue

                if status == "scheduled" and scheduled_at:
                    errors.append({"email_id": email_id, "reason": "Scheduled emails can only be sent immediately"})
                    continue

                campaign_id = email["campaign_id"]

                # ── Resolve SMTP credentials from brands ──────────────────────
                smtp_creds = _resolve_smtp_for_campaign(campaign_id, user_id, cursor)
                sender_email = smtp_creds["sender_email"]

                # ── Resolve BCC ───────────────────────────────────────────────
                cursor.execute("SELECT bcc FROM campaign_preferences WHERE campaign_id = %s", (campaign_id,))
                prefs_bcc_row = cursor.fetchone()
                cursor.execute("SELECT bcc FROM global_settings WHERE user_id = %s", (user_id,))
                global_bcc_row = cursor.fetchone()
                bcc_val = (
                    (prefs_bcc_row["bcc"] if prefs_bcc_row else None)
                    or (global_bcc_row["bcc"] if global_bcc_row else None)
                )

                smtp_config = {
                    "sender_email":    smtp_creds["sender_email"],
                    "sender_password": smtp_creds["sender_password"],
                    "smtp_host":       smtp_creds["smtp_host"],
                    "smtp_port":       smtp_creds["smtp_port"],
                    "bcc":             bcc_val,
                }

                # ── Opt-out check ─────────────────────────────────────────────
                recipient_email = email["recipient_email"]
                if not scheduled_at and _is_opted_out(sender_email, recipient_email):
                    reason = f"Recipient {recipient_email} has unsubscribed from {sender_email}"
                    if status == "primary":
                        cursor.execute("""
                            INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                               recipient_email, status, timezone)
                            VALUES (%s, %s, %s, %s, 'failed', 'UTC')
                        """, (email["campaign_company_id"], email["email_subject"],
                              email["email_content"], email["recipient_email"]))
                        failed_id = cursor.lastrowid
                    else:
                        cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (email_id,))
                        failed_id = email_id
                    cursor.execute(
                        "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                        (failed_id, reason),
                    )
                    conn.commit()
                    errors.append({"email_id": email_id, "reason": reason})
                    continue

                # ── Branding + attachment resolution ──────────────────────────
                if status == "primary":
                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments
                        FROM campaign_company WHERE id = %s
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT cp.inherit_global_settings, cp.inherit_global_attachments,
                               cp.brand_id
                        FROM campaign_preferences cp WHERE cp.campaign_id = %s
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    # Branding always comes from the campaign's linked brand
                    brand_id = campaign_prefs["brand_id"] if campaign_prefs else None
                    if brand_id:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE id = %s",
                            (brand_id,)
                        )
                    else:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE user_id = %s AND is_default = 1 LIMIT 1",
                            (user_id,)
                        )
                    brand_row = cursor.fetchone()
                    signature      = brand_row["signature"]      if brand_row else None
                    logo_blob      = brand_row["logo"]           if brand_row else None
                    logo_mime_type = brand_row["logo_mime_type"] if brand_row else None

                    inherit_global_attachments = (
                        campaign_prefs["inherit_global_attachments"]
                        if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
                        else 1
                    )

                    baked_attachment_ids = resolve_attachment_ids_for_primary(
                        email_id, campaign_id, user_id, cursor,
                        inherit_campaign_attachments, inherit_global_attachments
                    )
                else:
                    signature            = email["signature"]
                    logo_blob            = email["logo"]
                    logo_mime_type       = email.get("logo_mime_type")
                    baked_attachment_ids = None

                email_data = dict(email)

                # ── Schedule or send ──────────────────────────────────────────
                if scheduled_at:
                    if status == "primary":
                        cursor.execute("""
                            INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                               recipient_email, status, timezone, signature, logo, logo_mime_type,
                                               sent_at, html_email)
                            VALUES (%s, %s, %s, %s, 'scheduled', 'UTC', %s, %s, %s, %s, %s)
                        """, (
                            email["campaign_company_id"], email["email_subject"], email["email_content"],
                            email["recipient_email"], signature, logo_blob, logo_mime_type,
                            scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email["html_email"],
                        ))
                        new_email_id = cursor.lastrowid
                        for att_id in baked_attachment_ids:
                            cursor.execute("""
                                INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                                VALUES (%s, %s)
                            """, (new_email_id, att_id))
                    elif status == "draft":
                        cursor.execute("""
                            UPDATE emails SET status = 'scheduled', sent_at = %s WHERE id = %s
                        """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))
                        new_email_id = email_id
                    else:
                        cursor.execute("""
                            UPDATE emails SET sent_at = %s WHERE id = %s
                        """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))
                        new_email_id = email_id

                    conn.commit()
                    sent_count += 1
                    continue

                else:
                    # Immediate send
                    if status == "primary":
                        cursor.execute("""
                            INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                               recipient_email, status, timezone, signature, logo, logo_mime_type,
                                               html_email)
                            VALUES (%s, %s, %s, %s, 'sending', 'UTC', %s, %s, %s, %s)
                        """, (
                            email["campaign_company_id"], email["email_subject"], email["email_content"],
                            email["recipient_email"], signature, logo_blob, logo_mime_type, email["html_email"],
                        ))
                        new_email_id = cursor.lastrowid
                        for att_id in baked_attachment_ids:
                            cursor.execute("""
                                INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                                VALUES (%s, %s)
                            """, (new_email_id, att_id))
                    else:
                        cursor.execute("UPDATE emails SET status = 'sending' WHERE id = %s", (email_id,))
                        new_email_id = email_id

                    conn.commit()

            # ── SMTP call outside DB context ──────────────────────────────────
            with get_connection() as conn:
                resolved_attachments = get_own_attachments(new_email_id, conn.cursor())

            inline_image_attachments = _resolve_inline_image_attachments(
                email_data["email_content"], user_id
            )

            loop = asyncio.new_event_loop()
            send_result = loop.run_until_complete(
                svc_send_email(
                    company_name=email_data["recipient_email"] or "Recipient",
                    company_email=email_data["recipient_email"],
                    email_body=email_data["email_content"],
                    email_id=new_email_id,
                    subject=email_data["email_subject"],
                    attachments=resolved_attachments,
                    inline_images=inline_image_attachments or None,
                    logo_blob=logo_blob,
                    signature=signature,
                    smtp_config=smtp_config,
                    html_email=bool(email_data.get("html_email", 0)),
                )
            )
            loop.close()

            with get_connection() as conn:
                cursor = conn.cursor()
                if send_result.success:
                    cursor.execute("""
                        UPDATE emails SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = %s
                    """, (new_email_id,))
                    conn.commit()
                    sent_count += 1
                else:
                    cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (new_email_id,))
                    cursor.execute(
                        "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                        (new_email_id, f"Send failed: {send_result.message}"),
                    )
                    conn.commit()
                    errors.append({"email_id": email_id, "reason": send_result.message})

        except Exception as e:
            print(f"[BulkSend] email_id={email_id} failed: {e}")
            errors.append({"email_id": email_id, "reason": str(e)})
            continue

    return BulkSendResponse(
        sent=sent_count,
        failed=len(errors),
        errors=errors,
    )


# ==================================================================================
# POST /email/draft/ - Save emails as drafts (bulk)
# ==================================================================================

class BulkDraftRequest(BaseModel):
    email_ids: List[int]

class BulkDraftResponse(BaseModel):
    drafted: int
    failed: int
    draft_ids: List[int]
    errors: List[dict]

@email_actions_router.post("/draft/", response_model=BulkDraftResponse)
def save_as_draft_bulk(
    request: BulkDraftRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save one or more emails as drafts."""
    user_id = current_user["user_id"]

    if not request.email_ids:
        raise HTTPException(status_code=400, detail="email_ids must not be empty")

    draft_ids: List[int] = []
    errors: List[dict] = []

    for email_id in request.email_ids:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT e.*, cc.campaign_id, c.user_id
                    FROM emails e
                    JOIN campaign_company cc ON e.campaign_company_id = cc.id
                    JOIN campaigns c ON cc.campaign_id = c.id
                    WHERE e.id = %s AND c.user_id = %s
                """, (email_id, user_id))
                email = cursor.fetchone()

                if not email:
                    errors.append({"email_id": email_id, "reason": "Email not found"})
                    continue

                if email["status"] == "draft":
                    errors.append({"email_id": email_id, "reason": "Email is already a draft"})
                    continue

                if email["status"] == "primary":
                    campaign_id = email["campaign_id"]

                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments
                        FROM campaign_company WHERE id = %s
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT cp.inherit_global_settings, cp.inherit_global_attachments, cp.brand_id
                        FROM campaign_preferences cp WHERE cp.campaign_id = %s
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    # Branding always from campaign's linked brand
                    brand_id = campaign_prefs["brand_id"] if campaign_prefs else None
                    if brand_id:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE id = %s",
                            (brand_id,)
                        )
                    else:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE user_id = %s AND is_default = 1 LIMIT 1",
                            (user_id,)
                        )
                    brand_row = cursor.fetchone()
                    signature      = brand_row["signature"]      if brand_row else None
                    logo_blob      = brand_row["logo"]           if brand_row else None
                    logo_mime_type = brand_row["logo_mime_type"] if brand_row else None

                    inherit_global_attachments = (
                        campaign_prefs["inherit_global_attachments"]
                        if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
                        else 1
                    )

                    baked_attachment_ids = resolve_attachment_ids_for_primary(
                        email_id, campaign_id, user_id, cursor,
                        inherit_campaign_attachments, inherit_global_attachments
                    )
                else:
                    signature            = email["signature"]
                    logo_blob            = email["logo"]
                    logo_mime_type       = email["logo_mime_type"]
                    baked_attachment_ids = None

                cursor.execute("""
                    INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                       recipient_email, status, timezone, signature, logo, logo_mime_type,
                                       html_email)
                    VALUES (%s, %s, %s, %s, 'draft', %s, %s, %s, %s, %s)
                """, (
                    email["campaign_company_id"],
                    email["email_subject"],
                    email["email_content"],
                    email["recipient_email"],
                    email["timezone"],
                    signature,
                    logo_blob,
                    logo_mime_type,
                    email["html_email"],
                ))

                draft_id = cursor.lastrowid

                if baked_attachment_ids is not None:
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (%s, %s)
                        """, (draft_id, att_id))
                else:
                    cursor.execute("""
                        INSERT INTO email_attachments (email_id, attachment_id, created_at)
                        SELECT %s, attachment_id, created_at
                        FROM email_attachments WHERE email_id = %s
                    """, (draft_id, email_id))

                conn.commit()
                draft_ids.append(draft_id)

        except Exception as e:
            print(f"[BulkDraft] email_id={email_id} failed: {e}")
            errors.append({"email_id": email_id, "reason": str(e)})
            continue

    return BulkDraftResponse(
        drafted=len(draft_ids),
        failed=len(errors),
        draft_ids=draft_ids,
        errors=errors,
    )


# ==================================================================================
# POST /email/smart-schedule — Schedule with staggered timing
# ==================================================================================

class SmartScheduleRequest(BaseModel):
    email_ids: List[int]
    start_time: str
    initial_companies: int
    interval_minutes: int
    increment: int

class SmartScheduleResponse(BaseModel):
    scheduled: int
    failed: int
    message: str

@email_actions_router.post("/smart-schedule/", response_model=SmartScheduleResponse)
def smart_schedule_emails(
    request: SmartScheduleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Schedule multiple emails with staggered batched timing."""
    user_id = current_user["user_id"]

    if not request.email_ids:
        raise HTTPException(status_code=400, detail="email_ids must not be empty")
    if request.initial_companies < 1:
        raise HTTPException(status_code=400, detail="initial_companies must be at least 1")
    if request.interval_minutes < 1:
        raise HTTPException(status_code=400, detail="interval_minutes must be at least 1")
    if request.increment < 0:
        raise HTTPException(status_code=400, detail="increment must be 0 or greater")

    try:
        start_dt = datetime.fromisoformat(request.start_time.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_time format. Use ISO 8601.")

    # ── Assign each email_id to a batch slot ─────────────────────────────────
    from datetime import timedelta
    assignments: List[tuple] = []
    remaining = list(request.email_ids)
    batch_num = 0

    while remaining:
        batch_size   = max(1, request.initial_companies + batch_num * request.increment)
        batch_ids    = remaining[:batch_size]
        remaining    = remaining[batch_size:]
        scheduled_at = start_dt + timedelta(minutes=batch_num * request.interval_minutes)
        for eid in batch_ids:
            assignments.append((eid, scheduled_at))
        batch_num += 1

    # ── Process each email ────────────────────────────────────────────────────
    scheduled_count = 0
    failed_count    = 0

    for email_id, scheduled_at in assignments:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT e.*, cc.campaign_id, c.user_id
                    FROM emails e
                    JOIN campaign_company cc ON e.campaign_company_id = cc.id
                    JOIN campaigns c ON cc.campaign_id = c.id
                    WHERE e.id = %s AND c.user_id = %s
                """, (email_id, user_id))
                email = cursor.fetchone()

                if not email or email["status"] not in ("primary", "draft", "scheduled", "failed"):
                    failed_count += 1
                    continue

                campaign_id = email["campaign_id"]

                if email["status"] == "primary":
                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments
                        FROM campaign_company WHERE id = %s
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT cp.inherit_global_settings, cp.inherit_global_attachments, cp.brand_id
                        FROM campaign_preferences cp WHERE cp.campaign_id = %s
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    # Branding always from campaign's linked brand
                    brand_id = campaign_prefs["brand_id"] if campaign_prefs else None
                    if brand_id:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE id = %s",
                            (brand_id,)
                        )
                    else:
                        cursor.execute(
                            "SELECT signature, logo, logo_mime_type FROM brands WHERE user_id = %s AND is_default = 1 LIMIT 1",
                            (user_id,)
                        )
                    brand_row = cursor.fetchone()
                    signature      = brand_row["signature"]      if brand_row else None
                    logo_blob      = brand_row["logo"]           if brand_row else None
                    logo_mime_type = brand_row["logo_mime_type"] if brand_row else None

                    inherit_global_attachments = (
                        campaign_prefs["inherit_global_attachments"]
                        if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
                        else 1
                    )

                    baked_attachment_ids = resolve_attachment_ids_for_primary(
                        email_id, campaign_id, user_id, cursor,
                        inherit_campaign_attachments, inherit_global_attachments
                    )

                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status, timezone, signature, logo, logo_mime_type,
                                           sent_at, html_email)
                        VALUES (%s, %s, %s, %s, 'scheduled', 'UTC', %s, %s, %s, %s, %s)
                    """, (
                        email["campaign_company_id"],
                        email["email_subject"],
                        email["email_content"],
                        email["recipient_email"],
                        signature,
                        logo_blob,
                        logo_mime_type,
                        scheduled_at.strftime('%Y-%m-%d %H:%M:%S'),
                        email["html_email"],
                    ))
                    new_email_id = cursor.lastrowid

                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (%s, %s)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = %s WHERE id = %s
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))

                elif email["status"] in ("scheduled", "failed"):
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = %s WHERE id = %s
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))

                conn.commit()
                scheduled_count += 1

        except Exception:
            failed_count += 1
            continue

    if scheduled_count == 0:
        raise HTTPException(status_code=400, detail=f"All {failed_count} emails failed to schedule")

    return SmartScheduleResponse(
        scheduled=scheduled_count,
        failed=failed_count,
        message=f"{scheduled_count} email{'s' if scheduled_count != 1 else ''} scheduled"
                + (f", {failed_count} failed" if failed_count else ""),
    )