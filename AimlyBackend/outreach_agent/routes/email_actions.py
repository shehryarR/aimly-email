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
import re
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
from tools.email_sender_tool import AttachmentInfo

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

    These are passed alongside regular attachments to email_sender_tool,
    which then replaces the placeholders with inline <img> tags.
    """
    from pathlib import Path

    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

    placeholders = re.findall(r'\{\{([^}]+)\}\}', email_content)
    print(f"[InlineImg] Placeholders in content: {placeholders}")

    if not placeholders:
        return []

    # Only look up filenames that have image extensions
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
    query_type: str = Query("plain", description="Email generation mode: 'plain' = LLM plain text, 'html' = LLM styled HTML, 'template' = use campaign template"),
    force: bool = Query(False, description="If True, always regenerate even if a matching email already exists"),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate an email for a specific company within a campaign.

    Parameters:
    - query_type:
        * 'plain':    Use LLM to generate a plain text email
        * 'html':     Use LLM to generate a styled HTML email
        * 'template': Use campaign email template, replace {{company_name}} placeholder

    Stores only core email content (subject, body, recipient). Branding and attachments
    are resolved at send time based on inheritance flags.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id FROM campaigns WHERE id = %s AND user_id = %s
        """, (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute("""
            SELECT * FROM companies WHERE id = %s AND user_id = %s
        """, (company_id, user_id))
        company = cursor.fetchone()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        cursor.execute("""
            SELECT id, inherit_campaign_attachments, inherit_campaign_branding FROM campaign_company
            WHERE campaign_id = %s AND company_id = %s
        """, (campaign_id, company_id))
        cc_relationship = cursor.fetchone()
        if not cc_relationship:
            raise HTTPException(status_code=404, detail="Company not associated with this campaign")

        cc_id = cc_relationship["id"]
        inherit_campaign_attachments = cc_relationship["inherit_campaign_attachments"]

        company_name  = company["name"]
        company_email = company["email"]

        if query_type not in ("plain", "html", "template"):
            raise HTTPException(status_code=400, detail="query_type must be 'plain', 'html', or 'template'")

        if query_type in ("plain", "html"):
            llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)
            if not llm_api_key:
                raise HTTPException(
                    status_code=400,
                    detail="No LLM API key configured. Please add one in Settings → API Keys."
                )

            cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = %s", (user_id,))
            key_row = cursor.fetchone()

            llm_config = {
                "api_key": llm_api_key,
                "model":   (key_row["llm_model"] if key_row else None) or "gemini-2.0-flash",
            }

            cursor.execute("""
                SELECT business_name, business_info, goal, value_prop,
                       tone, cta, extras, email_instruction,
                       inherit_global_settings
                FROM campaign_preferences WHERE campaign_id = %s
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
                    FROM global_settings WHERE user_id = %s
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

        else:  # query_type == "template"
            cursor.execute("""
                SELECT template_email, template_html_email FROM campaign_preferences
                WHERE campaign_id = %s
            """, (campaign_id,))
            template_row = cursor.fetchone()
            if not template_row or not template_row["template_email"]:
                raise HTTPException(
                    status_code=400,
                    detail="No email template found for this campaign. Please generate one first."
                )

            template_email = template_row["template_email"]
            template_html_email_flag = int(template_row["template_html_email"]) if template_row["template_html_email"] is not None else 0
            content = template_email.replace("{{company_name}}", company_name)

            if content.startswith("SUBJECT:"):
                lines = content.split("\n", 1)
                subject = lines[0].replace("SUBJECT:", "").strip()
                body = lines[1].strip() if len(lines) > 1 else ""
            else:
                subject = f"Reaching out to {company_name}"
                body = content

        # For plain/html: check existing primary email before calling LLM (skip if force=True)
        if query_type in ("plain", "html") and not force:
            cursor.execute("""
                SELECT id, email_subject, email_content, recipient_email, html_email
                FROM emails
                WHERE campaign_company_id = %s AND status = 'primary'
            """, (cc_id,))
            existing = cursor.fetchone()
            if existing and existing["email_content"] and existing["email_content"].strip():
                existing_is_html = bool(existing["html_email"])
                requested_html   = (query_type == "html")
                if existing_is_html == requested_html:
                    # Type matches — return existing without LLM call
                    return MessageResponse(
                        message=f"Email loaded ({query_type})",
                        email_id=existing["id"]
                    )

    # Outside the first connection — now open a second one to write
    if query_type in ("plain", "html"):
        try:
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
                WHERE campaign_company_id = %s AND status = 'primary'
            """, (cc_id,))
            primary_email = cursor.fetchone()

            if query_type == "html":
                html_email_flag = 1
            elif query_type == "template":
                html_email_flag = template_html_email_flag
            else:
                html_email_flag = 0

            if primary_email:
                cursor.execute("""
                    UPDATE emails
                    SET email_subject = %s, email_content = %s, recipient_email = %s, html_email = %s
                    WHERE id = %s
                """, (subject, body, company_email, html_email_flag, primary_email["id"]))
                email_id = primary_email["id"]
            else:
                cursor.execute("""
                    INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                       recipient_email, status, html_email)
                    VALUES (%s, %s, %s, %s, 'primary', %s)
                """, (cc_id, subject, body, company_email, html_email_flag))
                email_id = cursor.lastrowid

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save generated email: {str(e)}")

    return MessageResponse(
        message=f"Email generated successfully ({query_type})",
        email_id=email_id
    )


# ==================================================================================
# POST /email/campaign/{campaign_id}/bulk-generate - Generate emails for many companies
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
    """
    Generate emails for multiple companies in a campaign in a single API call.

    Iterates company_ids server-side, runs the same generation logic as the
    single endpoint, skips failures with logged errors, and returns a summary.
    """
    user_id = current_user["user_id"]

    if not request.company_ids:
        raise HTTPException(status_code=400, detail="company_ids must not be empty")

    query_type = request.query_type
    force      = request.force

    if query_type not in ("plain", "html", "template"):
        raise HTTPException(status_code=400, detail="query_type must be 'plain', 'html', or 'template'")

    # ── Validate campaign ─────────────────────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM campaigns WHERE id = %s AND user_id = %s", (campaign_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

    # ── Load shared config once (LLM key, model, campaign prefs, template) ───
    llm_config         = None
    user_instruction   = None   # built per-company for plain/html (needs company_name)
    shared_prefs       = None
    global_prefs       = None
    inherit_global_settings = 1
    template_email          = None
    template_html_email_flag = 0

    if query_type in ("plain", "html"):
        llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)
        if not llm_api_key:
            raise HTTPException(
                status_code=400,
                detail="No LLM API key configured. Please add one in Settings → API Keys."
            )

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = %s", (user_id,))
            key_row = cursor.fetchone()
            llm_config = {
                "api_key": llm_api_key,
                "model":   (key_row["llm_model"] if key_row else None) or "gemini-2.0-flash",
            }

            cursor.execute("""
                SELECT business_name, business_info, goal, value_prop,
                       tone, cta, extras, email_instruction, inherit_global_settings
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
                    SELECT business_name, business_info, goal, value_prop,
                           tone, cta, extras, email_instruction
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
                    detail="No email template found for this campaign. Please generate one first."
                )
            template_email           = template_row["template_email"]
            template_html_email_flag = int(template_row["template_html_email"]) if template_row["template_html_email"] is not None else 0

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

            # ── Build subject/body ────────────────────────────────────────────
            if query_type in ("plain", "html"):
                # Check existing primary email (skip LLM if force=False and type matches)
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
                            continue  # already exists and type matches, skip

                context_parts = []
                for field in ("business_name", "business_info", "goal", "value_prop", "cta", "tone", "extras", "email_instruction"):
                    val = get_pref_with_default(field)
                    if val:
                        label = {
                            "business_name": "Business Name", "business_info": "Business Info",
                            "goal": "Goal", "value_prop": "Value Proposition", "cta": "Call to Action",
                            "tone": "Tone", "extras": "Additional Context", "email_instruction": "Email Instructions",
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

            # ── Upsert primary email row ──────────────────────────────────────
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
            WHERE e.id = %s AND c.user_id = %s
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
            FROM user_keys WHERE user_id = %s
        """, (user_id,))
        smtp_row = cursor.fetchone()

        if not smtp_row or not smtp_row["email_address"] or not smtp_row["email_password"]:
            raise HTTPException(
                status_code=400,
                detail="No SMTP credentials configured. Please add them in Settings → API Keys."
            )

        campaign_id = email["campaign_id"]

        # ── Resolve BCC ───────────────────────────────────────────────────────
        cursor.execute("SELECT bcc FROM campaign_preferences WHERE campaign_id = %s", (campaign_id,))
        prefs_bcc_row = cursor.fetchone()
        cursor.execute("SELECT bcc FROM global_settings WHERE user_id = %s", (user_id,))
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
            reason = f"Recipient {recipient_email} has unsubscribed from {sender_email}"
            if email["status"] == "primary":
                cursor.execute("""
                    INSERT INTO emails (campaign_company_id, email_subject, email_content,
                                       recipient_email, status, timezone)
                    VALUES (%s, %s, %s, %s, 'failed', 'UTC')
                """, (
                    email["campaign_company_id"],
                    email["email_subject"],
                    email["email_content"],
                    email["recipient_email"],
                ))
                failed_id = cursor.lastrowid
            else:
                cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (email_id,))
                failed_id = email_id
            cursor.execute(
                "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                (failed_id, reason),
            )
            conn.commit()
            raise HTTPException(
                status_code=403,
                detail=f"{recipient_email} has unsubscribed and will not receive emails from {sender_email}."
            )

        # ── Branding + Attachment resolution ─────────────────────────────────
        if email["status"] == "primary":
            cursor.execute("""
                SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                FROM campaign_company WHERE id = %s
            """, (email["campaign_company_id"],))
            cc_row = cursor.fetchone()
            inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
            inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

            cursor.execute("""
                SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                FROM campaign_preferences WHERE campaign_id = %s
            """, (campaign_id,))
            campaign_prefs = cursor.fetchone()

            cursor.execute("""
                SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = %s
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

                    # Bake ALL resolved attachment IDs (own + inherited) into new row.
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (%s, %s)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'scheduled', sent_at = %s WHERE id = %s
                    """, (scheduled_at.strftime('%Y-%m-%d %H:%M:%S'), email_id))
                    new_email_id = email_id

                elif email["status"] == "scheduled":
                    cursor.execute("""
                        UPDATE emails SET sent_at = %s WHERE id = %s
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
                                           recipient_email, status, timezone, signature, logo, logo_mime_type,
                                           html_email)
                        VALUES (%s, %s, %s, %s, 'sending', 'UTC', %s, %s, %s, %s)
                    """, (
                        email["campaign_company_id"],
                        email["email_subject"],
                        email["email_content"],
                        email["recipient_email"],
                        signature,
                        logo_blob,
                        logo_mime_type,
                        email["html_email"],
                    ))
                    new_email_id = cursor.lastrowid

                    # Bake ALL resolved attachment IDs into new row.
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (%s, %s)
                        """, (new_email_id, att_id))

                elif email["status"] == "draft":
                    cursor.execute("""
                        UPDATE emails SET status = 'sending' WHERE id = %s
                    """, (email_id,))
                    new_email_id = email_id

                elif email["status"] in ("scheduled", "failed"):
                    cursor.execute("""
                        UPDATE emails SET status = 'sending' WHERE id = %s
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

            # Resolve any {{filename}} inline image placeholders from user's library
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
        except Exception as e:
            with get_connection() as conn:
                conn.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (new_email_id,))
                conn.execute(
                    "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                    (new_email_id, f"SMTP exception: {e}"),
                )
                conn.commit()
            raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

        with get_connection() as conn:
            cursor = conn.cursor()
            if send_result.success:
                cursor.execute("""
                    UPDATE emails SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = %s
                """, (new_email_id,))
            else:
                cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (new_email_id,))
                cursor.execute(
                    "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
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
# POST /email/draft/ - Save one or more emails as drafts (bulk)
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
    """
    Save one or more emails as drafts.

    Accepts a list of email_ids. For each:
    - If primary email: Creates a new draft copy (primary remains unchanged)
    - If sent/scheduled/failed email: Creates a new draft copy (original remains unchanged)
    - If already a draft: logged as error, skipped
    - If not found or DB error: logged as error, skipped

    Returns a summary of drafted count, failed count, new draft IDs, and per-email errors.
    """
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

                # For primary emails, resolve branding and attachments exactly as send/schedule does,
                # so the new draft entry has the fully baked values rather than NULLs.
                if email["status"] == "primary":
                    campaign_id = email["campaign_id"]

                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                        FROM campaign_company WHERE id = %s
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                        FROM campaign_preferences WHERE campaign_id = %s
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = %s
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
                    # Primary: bake the fully resolved attachment set into the new draft row.
                    for att_id in baked_attachment_ids:
                        cursor.execute("""
                            INSERT IGNORE INTO email_attachments (email_id, attachment_id)
                            VALUES (%s, %s)
                        """, (draft_id, att_id))
                else:
                    # Sent/scheduled: copy the already-baked attachment rows as-is.
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
            FROM user_keys WHERE user_id = %s
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
                    WHERE e.id = %s AND c.user_id = %s
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
                cursor.execute("SELECT bcc FROM campaign_preferences WHERE campaign_id = %s", (campaign_id,))
                prefs_bcc_row = cursor.fetchone()
                cursor.execute("SELECT bcc FROM global_settings WHERE user_id = %s", (user_id,))
                global_bcc_row = cursor.fetchone()

                # ── Branding + attachment resolution (primary only) ───────────
                if email["status"] == "primary":
                    cursor.execute("""
                        SELECT id, inherit_campaign_attachments, inherit_campaign_branding
                        FROM campaign_company WHERE id = %s
                    """, (email["campaign_company_id"],))
                    cc_row = cursor.fetchone()
                    inherit_campaign_branding    = cc_row["inherit_campaign_branding"]    if cc_row else 1
                    inherit_campaign_attachments = cc_row["inherit_campaign_attachments"] if cc_row else 1

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type, inherit_global_settings, inherit_global_attachments
                        FROM campaign_preferences WHERE campaign_id = %s
                    """, (campaign_id,))
                    campaign_prefs = cursor.fetchone()

                    cursor.execute("""
                        SELECT signature, logo, logo_mime_type FROM global_settings WHERE user_id = %s
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