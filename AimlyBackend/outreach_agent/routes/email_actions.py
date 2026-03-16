"""
Email Actions Routes — Generation, Sending & Drafting
Handles email operations with side effects: LLM generation, SMTP sending, scheduling, and draft creation.

INHERITANCE RULES:
══════════════════════════════════════════════════════════════════════

GENERATING PERSONALIZED EMAIL (LLM mode):
  inherit_global_settings = 1 → use global settings fields, fallback to default
  inherit_global_settings = 0 → use campaign fields, fallback to default

SENDING/DRAFTING/SCHEDULING PRIMARY EMAIL:
  Branding: same resolution as reading primary email
  Attachments:
    inherit_campaign_attachments = 0 → email's own attachments only
    inherit_campaign_attachments = 1:
      inherit_global_attachments = 0 → campaign attachments only
      inherit_global_attachments = 1 → global attachments only
  New email entry is created with the final resolved branding + attachments baked in.

SENDING/DRAFTING/SCHEDULING A DRAFT or SCHEDULED EMAIL:
  Use the email's own stored branding and attachments only.

DRAFTING A SENT or SCHEDULED EMAIL:
  Use the email's own stored branding and attachments only.
"""

import asyncio
import os
import requests
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from core.database.connection import get_connection
from routes.auth import get_current_user
from routes.user_keys import _read_cookie_key, _LLM_COOKIE
from services.email_service import (
    generate_email as svc_generate_email,
    send_email as svc_send_email,
)
from .utils.email_helpers import (
    SendEmailRequest,
    MessageResponse,
    resolve_branding,
    resolve_attachments_for_primary,
    resolve_attachment_ids_for_primary,
    get_own_attachments,
)

email_actions_router = APIRouter(prefix="/email", tags=["Email Actions"])


# =============================================================================
# HELPERS
# =============================================================================

def _is_opted_out(sender_email: str, receiver_email: str) -> bool:
    """
    Check the microservice opt-out list before sending.
    Returns True if the receiver has unsubscribed from this sender.
    Returns False if opted-in, microservice not configured, or on any error.
    """
    base_url   = os.getenv("MICROSERVICE_BASE_URL")
    api_key    = os.getenv("MICROSERVICE_API_KEY")
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
# POST /email/campaign/{campaign_id}/company/{company_id}/generate-email
# ==================================================================================
@email_actions_router.post("/campaign/{campaign_id}/company/{company_id}/generate-email/", response_model=MessageResponse)
def generate_email(
    campaign_id: int,
    company_id: int,
    http_request: Request,
    personalized: Optional[bool] = Query(None, description="True=LLM, False=template, omit=auto (template if exists, else LLM)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an email for a specific company within a campaign.

    Parameters:
    - personalized (optional boolean):
        * True:  Use LLM to generate a personalized email from company info
        * False: Use campaign email template, replace {{company_name}} placeholder
        * omitted (None): Auto-detect — use template if one exists for this campaign,
                          otherwise fall back to LLM generation

    Stores only core email content (subject, body, recipient). Branding and attachments
    are resolved at send time based on inheritance flags.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id FROM campaigns WHERE id = ? AND user_id = ?
        """, (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute("""
            SELECT * FROM companies WHERE id = ? AND user_id = ?
        """, (company_id, user_id))
        company = cursor.fetchone()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        cursor.execute("""
            SELECT id, inherit_campaign_attachments, inherit_campaign_branding FROM campaign_company
            WHERE campaign_id = ? AND company_id = ?
        """, (campaign_id, company_id))
        cc_relationship = cursor.fetchone()
        if not cc_relationship:
            raise HTTPException(status_code=404, detail="Company not associated with this campaign")

        cc_id = cc_relationship["id"]
        inherit_campaign_attachments = cc_relationship["inherit_campaign_attachments"]

        company_name  = company["name"]
        company_email = company["email"]

        if personalized is None:
            cursor.execute("""
                SELECT template_email FROM campaign_preferences
                WHERE campaign_id = ?
            """, (campaign_id,))
            auto_row = cursor.fetchone()
            personalized = not (auto_row and auto_row["template_email"])

        if personalized:
            llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)
            if not llm_api_key:
                raise HTTPException(
                    status_code=400,
                    detail="No LLM API key configured. Please add one in Settings → API Keys."
                )

            cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = ?", (user_id,))
            key_row = cursor.fetchone()

            llm_config = {
                "api_key": llm_api_key,
                "model":   (key_row["llm_model"] if key_row else None) or "gemini-2.0-flash",
            }

            cursor.execute("""
                SELECT business_name, business_info, goal, value_prop,
                       tone, cta, extras, email_instruction,
                       inherit_global_settings
                FROM campaign_preferences WHERE campaign_id = ?
            """, (campaign_id,))
            prefs = cursor.fetchone()

            inherit_global_settings = (
                prefs["inherit_global_settings"]
                if prefs and prefs["inherit_global_settings"] is not None
                else 1
            )

            global_prefs = None
            if inherit_global_settings:
                cursor.execute("""
                    SELECT business_name, business_info, goal, value_prop,
                           tone, cta, extras, email_instruction
                    FROM global_settings WHERE user_id = ?
                """, (user_id,))
                global_prefs = cursor.fetchone()

            def get_pref(field):
                if inherit_global_settings:
                    val = global_prefs[field] if global_prefs else None
                else:
                    val = prefs[field] if prefs else None
                return val

            PREF_DEFAULTS = {
                "business_name":     "Our Company",
                "business_info":     "A professional services company",
                "goal":              "Generate leads and start a conversation",
                "value_prop":        "We provide high-quality solutions tailored to your needs",
                "cta":               "Schedule a quick call to learn more",
                "tone":              "Professional",
                "extras":            None,
                "email_instruction": None,
            }

            def get_pref_with_default(field):
                val = get_pref(field)
                return val if val is not None else PREF_DEFAULTS.get(field)

            context_parts = []
            if get_pref_with_default("business_name"):
                context_parts.append(f"Business Name: {get_pref_with_default('business_name')}")
            if get_pref_with_default("business_info"):
                context_parts.append(f"Business Info: {get_pref_with_default('business_info')}")
            if get_pref_with_default("goal"):
                context_parts.append(f"Goal: {get_pref_with_default('goal')}")
            if get_pref_with_default("value_prop"):
                context_parts.append(f"Value Proposition: {get_pref_with_default('value_prop')}")
            if get_pref_with_default("cta"):
                context_parts.append(f"Call to Action: {get_pref_with_default('cta')}")
            if get_pref_with_default("tone"):
                context_parts.append(f"Tone: {get_pref_with_default('tone')}")
            if get_pref_with_default("extras"):
                context_parts.append(f"Additional Context: {get_pref_with_default('extras')}")
            if get_pref_with_default("email_instruction"):
                context_parts.append(f"Email Instructions: {get_pref_with_default('email_instruction')}")

            user_instruction = (
                "\n".join(context_parts)
                or f"Write a professional outreach email to {company_name}."
            )

            company_details = company["company_info"] or None

        else:
            cursor.execute("""
                SELECT template_email FROM campaign_preferences
                WHERE campaign_id = ?
            """, (campaign_id,))
            template_row = cursor.fetchone()
            if not template_row or not template_row["template_email"]:
                raise HTTPException(
                    status_code=400,
                    detail="No email template found for this campaign. Please generate one first."
                )

            template_email = template_row["template_email"]
            content = template_email.replace("{{company_name}}", company_name)

            if content.startswith("SUBJECT:"):
                lines = content.split("\n", 1)
                subject = lines[0].replace("SUBJECT:", "").strip()
                body = lines[1].strip() if len(lines) > 1 else ""
            else:
                subject = f"Reaching out to {company_name}"
                body = content

            email_id = None

    if personalized:
        try:
            loop = asyncio.new_event_loop()
            email_result, _ = loop.run_until_complete(
                svc_generate_email(
                    company_name=company_name,
                    user_instruction=user_instruction,
                    llm_config=llm_config,
                    company_details=company_details,
                )
            )
            loop.close()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email generation failed: {str(e)}")

        subject = email_result.get("subject") or f"Reaching out to {company_name}"
        body = email_result.get("content") or ""

        if not body:
            raise HTTPException(status_code=500, detail="Email generation returned empty content.")

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT id FROM emails
                WHERE campaign_company_id = ? AND status = 'primary'
            """, (cc_id,))
            primary_email = cursor.fetchone()

            if primary_email:
                cursor.execute("""
                    UPDATE emails
                    SET email_subject = ?, email_content = ?, recipient_email = ?
                    WHERE id = ?
                """, (subject, body, company_email, primary_email["id"]))
                email_id = primary_email["id"]
            else:
                cursor.execute("""
                    INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                       recipient_email, status)
                    VALUES (?, ?, ?, ?, 'primary')
                """, (cc_id, subject, body, company_email))
                email_id = cursor.lastrowid

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save generated email: {str(e)}")

    return MessageResponse(
        message=f"Email generated successfully ({'LLM' if personalized else 'template'})",
        email_id=email_id
    )


# ==================================================================================
# POST /email/{email_id}/send - Send or schedule an email
# ==================================================================================
@email_actions_router.post("/{email_id}/send/", response_model=MessageResponse)
def send_email(
    email_id: int,
    request: SendEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send or schedule an email.

    Behavior:
    - For primary emails: Creates a new entry with status 'sending' (immediate) or 'scheduled'
    - For draft emails: Converts the draft to 'sending' (immediate) or 'scheduled'
    - For scheduled emails: Only accepts requests with no time set (send now), converts to 'sending'

    For primary emails, resolved attachments (own + inherited) are baked into
    email_attachments on the new row at creation time, so history is always complete.
    Branding is baked into the row's columns (unchanged).
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT e.*, cc.campaign_id, c.user_id
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE e.id = ? AND c.user_id = ?
        """, (email_id, user_id))

        email = cursor.fetchone()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        if email["status"] == "primary":
            pass
        elif email["status"] == "draft":
            pass
        elif email["status"] == "scheduled":
            if request.time:
                raise HTTPException(status_code=400, detail="Scheduled emails can only be sent immediately (no time parameter)")
        elif email["status"] == "failed":
            if request.time:
                raise HTTPException(status_code=400, detail="Failed emails can only be retried immediately (no time parameter)")
        else:
            raise HTTPException(status_code=400, detail=f"Cannot send email with status '{email['status']}'")

        cursor.execute("""
            SELECT email_address, email_password, smtp_host, smtp_port
            FROM user_keys WHERE user_id = ?
        """, (user_id,))
        smtp_row = cursor.fetchone()

        if not smtp_row or not smtp_row["email_address"] or not smtp_row["email_password"]:
            raise HTTPException(
                status_code=400,
                detail="No SMTP credentials configured. Please add them in Settings → API Keys."
            )

        campaign_id = email["campaign_id"]

        # ── Resolve BCC ───────────────────────────────────────────────────────
        cursor.execute("SELECT bcc FROM campaign_preferences WHERE campaign_id = ?", (campaign_id,))
        prefs_bcc_row = cursor.fetchone()
        cursor.execute("SELECT bcc FROM global_settings WHERE user_id = ?", (user_id,))
        global_bcc_row = cursor.fetchone()
        bcc_val = (
            (prefs_bcc_row["bcc"] if prefs_bcc_row else None)
            or (global_bcc_row["bcc"] if global_bcc_row else None)
        )

        smtp_config = {
            "sender_email":    smtp_row["email_address"],
            "sender_password": smtp_row["email_password"],
            "smtp_host":       smtp_row["smtp_host"] or "smtp.gmail.com",
            "smtp_port":       smtp_row["smtp_port"] or 587,
            "bcc":             bcc_val,
        }

        # ── Opt-out check ─────────────────────────────────────────────────────
        recipient_email = email["recipient_email"]
        sender_email    = smtp_row["email_address"]
        if not request.time and _is_opted_out(sender_email, recipient_email):
            raise HTTPException(
                status_code=403,
                detail=f"{recipient_email} has unsubscribed and will not receive emails from {sender_email}."
            )

        # ── Branding + Attachment resolution ─────────────────────────────────
        if email["status"] == "primary":
            cursor.execute("""
                SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                FROM campaign_company WHERE id = ?
            """, (email["campaign_company_id"],))
            cc_row = cursor.fetchone()
            inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
            inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

            cursor.execute("""
                SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                FROM campaign_preferences WHERE campaign_id = ?
            """, (campaign_id,))
            campaign_prefs = cursor.fetchone()

            cursor.execute("""
                SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = ?
            """, (user_id,))
            global_prefs = cursor.fetchone()

            signature, logo_blob, logo_mime_type = resolve_branding(
                email, campaign_prefs, global_prefs, inherit_campaign_branding
            )

            inherit_global_attachments = (
                campaign_prefs["inherit_global_attachments"]
                if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
                else 1
            )

            # Resolve attachment IDs inside DB block so they can be baked into
            # email_attachments on the new row (history fidelity).
            # Returns plain ints — no AttachmentInfo dependency.
            baked_attachment_ids = resolve_attachment_ids_for_primary(
                email_id, campaign_id, user_id, cursor,
                inherit_campaign_attachments, inherit_global_attachments
            )

        else:
            # Draft, scheduled, or failed — updated in place, existing email_attachments correct.
            # No baking needed. Attachments for SMTP fetched after new_email_id is known.
            signature            = email["signature"]
            logo_blob            = email["logo"]
            baked_attachment_ids = None  # not primary — no baking needed

        email_data = dict(email)

        try:
            if request.time:
                scheduled_at = datetime.fromisoformat(request.time.replace('Z', '+00:00'))

                if email["status"] == "primary":
                    # Create new scheduled email with branding baked in
                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status, timezone, signature, logo, logo_mime_type,
                                           sent_at)
                        VALUES (?, ?, ?, ?, 'scheduled', 'UTC', ?, ?, ?, ?)
                    """, (
                        email["campaign_company_id"],
                        email["email_subject"],
                        email["email_content"],
                        email["recipient_email"],
                        signature,
                        logo_blob,
                        logo_mime_type,
                        scheduled_at.strftime('%Y-%m-%d %H:%M:%S'),
                    ))
                    new_email_id = cursor.lastrowid

                    # Bake ALL resolved attachment IDs (own + inherited) into new row.
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT OR IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (?, ?)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = ? WHERE id = ?
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))
                    new_email_id = email_id

                elif email["status"] == "scheduled":
                    cursor.execute("""
                        UPDATE emails SET sent_at = ? WHERE id = ?
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))
                    new_email_id = email_id

                conn.commit()
                message = f"Email scheduled for {scheduled_at.strftime('%Y-%m-%d %H:%M UTC')}"

            else:
                # Send immediately
                if email["status"] == "primary":
                    # Create new sending email with branding baked in
                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status, timezone, signature, logo, logo_mime_type)
                        VALUES (?, ?, ?, ?, 'sending', 'UTC', ?, ?, ?)
                    """, (
                        email["campaign_company_id"],
                        email["email_subject"],
                        email["email_content"],
                        email["recipient_email"],
                        signature,
                        logo_blob,
                        logo_mime_type,
                    ))
                    new_email_id = cursor.lastrowid

                    # Bake ALL resolved attachment IDs into new row.
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT OR IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (?, ?)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'sending' WHERE id = ?
                    """, (email_id,))
                    new_email_id = email_id

                elif email["status"] in ("scheduled", "failed"):
                    cursor.execute("""
                        UPDATE emails SET status = 'sending' WHERE id = ?
                    """, (email_id,))
                    new_email_id = email_id

                conn.commit()
                message = "Email sending initiated"

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to prepare email: {str(e)}")

    # ── SMTP call outside DB context (immediate sends only) ───────────────────
    if not request.time:
        try:
            # Fetch AttachmentInfo objects for SMTP — always from the new row's
            # own email_attachments (which for primary now contains the full baked set).
            with get_connection() as conn:
                resolved_attachments = get_own_attachments(new_email_id, conn.cursor())

            loop = asyncio.new_event_loop()
            send_result = loop.run_until_complete(
                svc_send_email(
                    company_name=email_data["recipient_email"] or "Recipient",
                    company_email=email_data["recipient_email"],
                    email_body=email_data["email_content"],
                    email_id=new_email_id,
                    subject=email_data["email_subject"],
                    attachments=resolved_attachments,
                    logo_blob=logo_blob,
                    signature=signature,
                    smtp_config=smtp_config,
                )
            )
            loop.close()
        except Exception as e:
            with get_connection() as conn:
                conn.execute("UPDATE emails SET status = 'failed' WHERE id = ?", (new_email_id,))
                conn.execute(
                    "INSERT INTO failed_emails (email_id, reason) VALUES (?, ?)",
                    (new_email_id, f"SMTP exception: {e}"),
                )
                conn.commit()
            raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

        with get_connection() as conn:
            cursor = conn.cursor()
            if send_result.success:
                cursor.execute("""
                    UPDATE emails SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?
                """, (new_email_id,))
            else:
                cursor.execute("UPDATE emails SET status = 'failed' WHERE id = ?", (new_email_id,))
                cursor.execute(
                    "INSERT INTO failed_emails (email_id, reason) VALUES (?, ?)",
                    (new_email_id, f"Send failed: {send_result.message}"),
                )
            conn.commit()

        if not send_result.success:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {send_result.message}")

    return MessageResponse(
        message=message,
        email_id=new_email_id
    )


# ==================================================================================
# POST /email/{email_id}/draft - Save email as draft
# ==================================================================================
@email_actions_router.post("/{email_id}/draft/", response_model=MessageResponse)
def save_as_draft(
    email_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Save an email as a draft.

    Behavior:
    - If primary email: Creates a new draft copy (primary remains unchanged)
    - If sent email: Creates a new draft copy (sent remains unchanged)
    - If scheduled email: Creates a new draft copy (scheduled remains unchanged)

    Attachments are copied to the new draft email.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT e.*, cc.campaign_id, c.user_id
            FROM emails e
            JOIN campaign_company cc ON e.campaign_company_id = cc.id
            JOIN campaigns c ON cc.campaign_id = c.id
            WHERE e.id = ? AND c.user_id = ?
        """, (email_id, user_id))

        email = cursor.fetchone()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        if email["status"] == "draft":
            raise HTTPException(status_code=400, detail="Email is already a draft")

        # For primary emails, resolve branding and attachments exactly as send/schedule does,
        # so the new draft entry has the fully baked values rather than NULLs.
        if email["status"] == "primary":
            campaign_id = email["campaign_id"]

            cursor.execute("""
                SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                FROM campaign_company WHERE id = ?
            """, (email["campaign_company_id"],))
            cc_row = cursor.fetchone()
            inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
            inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

            cursor.execute("""
                SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                FROM campaign_preferences WHERE campaign_id = ?
            """, (campaign_id,))
            campaign_prefs = cursor.fetchone()

            cursor.execute("""
                SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = ?
            """, (user_id,))
            global_prefs = cursor.fetchone()

            signature, logo_blob, logo_mime_type = resolve_branding(
                email, campaign_prefs, global_prefs, inherit_campaign_branding
            )

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
            # Sent, scheduled, or failed emails already have branding + attachments baked in their own row.
            signature            = email["signature"]
            logo_blob            = email["logo"]
            logo_mime_type       = email["logo_mime_type"]
            baked_attachment_ids = None

        try:
            cursor.execute("""
                INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                   recipient_email, status, timezone, signature, logo, logo_mime_type)
                VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)
            """, (
                email["campaign_company_id"],
                email["email_subject"],
                email["email_content"],
                email["recipient_email"],
                email["timezone"],
                signature,
                logo_blob,
                logo_mime_type,
            ))

            draft_id = cursor.lastrowid

            if baked_attachment_ids is not None:
                # Primary: bake the fully resolved attachment set into the new draft row.
                for att_id in baked_attachment_ids:
                    cursor.execute("""
                        INSERT OR IGNORE INTO email_attachments (email_id, attachment_id)
                        VALUES (?, ?)
                    """, (draft_id, att_id))
            else:
                # Sent/scheduled: copy the already-baked attachment rows as-is.
                cursor.execute("""
                    INSERT INTO email_attachments (email_id, attachment_id, created_at)
                    SELECT ?, attachment_id, created_at
                    FROM email_attachments WHERE email_id = ?
                """, (draft_id, email_id))

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create draft: {str(e)}")

    return MessageResponse(
        message="Draft created successfully",
        email_id=draft_id
    )

# =============================================================================
# POST /email/smart-schedule — Schedule multiple emails with staggered timing
# =============================================================================

class SmartScheduleRequest(BaseModel):
    email_ids: List[int]
    start_time: str          # ISO datetime string for first batch
    initial_companies: int   # number of emails in first batch
    interval_minutes: int    # minutes between batches
    increment: int           # additional emails per subsequent batch


class SmartScheduleResponse(BaseModel):
    scheduled: int
    failed: int
    message: str


@email_actions_router.post("/smart-schedule/", response_model=SmartScheduleResponse)
def smart_schedule_emails(
    request: SmartScheduleRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Schedule multiple emails with staggered batched timing.

    Emails are assigned to batches based on:
      - Batch 0: initial_companies emails at start_time
      - Batch 1: (initial_companies + increment) emails at start_time + interval_minutes
      - Batch N: (initial_companies + N * increment) emails at start_time + N * interval_minutes

    Each email is processed exactly like POST /email/{email_id}/send/ with a time param:
      - Primary emails → new scheduled row created with branding + attachments baked in
      - Draft emails   → updated in place to scheduled
      - Already scheduled emails → sent_at updated
    """
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

    # ── Assign each email_id to a batch slot and compute its scheduled_at ────
    # Build list of (email_id, scheduled_at) pairs
    assignments: List[tuple] = []
    remaining = list(request.email_ids)
    batch_num = 0
    from datetime import timedelta

    while remaining:
        batch_size = request.initial_companies + batch_num * request.increment
        batch_size = max(1, batch_size)
        batch_ids  = remaining[:batch_size]
        remaining  = remaining[batch_size:]
        scheduled_at = start_dt + timedelta(minutes=batch_num * request.interval_minutes)
        for eid in batch_ids:
            assignments.append((eid, scheduled_at))
        batch_num += 1

    # ── Fetch SMTP credentials once ───────────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT email_address, email_password, smtp_host, smtp_port
            FROM user_keys WHERE user_id = ?
        """, (user_id,))
        smtp_row = cursor.fetchone()

    if not smtp_row or not smtp_row["email_address"] or not smtp_row["email_password"]:
        raise HTTPException(
            status_code=400,
            detail="No SMTP credentials configured. Please add them in Settings → API Keys."
        )

    # ── Process each email exactly as /send/ does ─────────────────────────────
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
                    WHERE e.id = ? AND c.user_id = ?
                """, (email_id, user_id))
                email = cursor.fetchone()

                if not email:
                    failed_count += 1
                    continue

                if email["status"] not in ("primary", "draft", "scheduled", "failed"):
                    failed_count += 1
                    continue

                campaign_id = email["campaign_id"]

                # ── Resolve BCC ───────────────────────────────────────────────
                cursor.execute("SELECT bcc FROM campaign_preferences WHERE campaign_id = ?", (campaign_id,))
                prefs_bcc_row = cursor.fetchone()
                cursor.execute("SELECT bcc FROM global_settings WHERE user_id = ?", (user_id,))
                global_bcc_row = cursor.fetchone()

                # ── Branding + attachment resolution (primary only) ───────────
                if email["status"] == "primary":
                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                        FROM campaign_company WHERE id = ?
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                        FROM campaign_preferences WHERE campaign_id = ?
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = ?
                    """, (user_id,))
                    global_prefs = cursor.fetchone()

                    signature, logo_blob, logo_mime_type = resolve_branding(
                        email, campaign_prefs, global_prefs, inherit_campaign_branding
                    )

                    inherit_global_attachments = (
                        campaign_prefs["inherit_global_attachments"]
                        if campaign_prefs and campaign_prefs["inherit_global_attachments"] is not None
                        else 1
                    )

                    baked_attachment_ids = resolve_attachment_ids_for_primary(
                        email_id, campaign_id, user_id, cursor,
                        inherit_campaign_attachments, inherit_global_attachments
                    )

                    # Create new scheduled row with branding baked in
                    cursor.execute("""
                        INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                           recipient_email, status, timezone, signature, logo, logo_mime_type,
                                           sent_at)
                        VALUES (?, ?, ?, ?, 'scheduled', 'UTC', ?, ?, ?, ?)
                    """, (
                        email["campaign_company_id"],
                        email["email_subject"],
                        email["email_content"],
                        email["recipient_email"],
                        signature,
                        logo_blob,
                        logo_mime_type,
                        scheduled_at.strftime('%Y-%m-%d %H:%M:%S'),
                    ))
                    new_email_id = cursor.lastrowid

                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT OR IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (?, ?)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = ? WHERE id = ?
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))

                elif email["status"] in ("scheduled", "failed"):
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = ? WHERE id = ?
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