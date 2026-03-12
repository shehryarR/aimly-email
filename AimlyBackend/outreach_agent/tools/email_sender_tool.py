"""
email_sender_tool.py — SMTP email construction and dispatch.

Pure logic layer — zero database operations.
SMTP credentials and BCC are passed in by the caller via smtp_config.
Falls back to environment variables when smtp_config is absent or incomplete.
UPDATED: Accepts attachment paths with display names for proper email attachments.
UPDATED: Accepts logo_blob (raw bytes) in addition to logo_path.
UPDATED: Fixed read-receipt endpoints and HMAC signing.
UPDATED: Added signed unsubscribe footer link.
UPDATED: Fixed logo alignment for iOS Mail (table-based layout).
"""

import hmac
import hashlib
from pydantic import BaseModel, Field
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
import smtplib
import os
import requests
from typing import Optional, List, Dict, Any
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()


# =============================================================================
# MODELS
# =============================================================================

class AttachmentInfo(BaseModel):
    """Attachment information with file path and display name"""
    file_path: str = Field(description="Full path to the attachment file on disk")
    display_name: str = Field(description="Filename to show in the email")

class EmailSenderInput(BaseModel):
    recipient_email: str                        = Field(description="Recipient email address")
    email_text: str                             = Field(description="Full email body")
    company_name: str                           = Field(description="Company name (fallback subject)")
    subject: str                                = Field(description="Email subject line")
    email_id: Optional[int]                     = Field(None, description="DB email ID for tracking pixel")
    sender_email: Optional[str]                 = Field(None, description="Sender email address for unsubscribe link")
    attachments: Optional[List[AttachmentInfo]] = Field(None, description="List of attachment info with paths and display names")
    logo_path: Optional[Path]                   = Field(None, description="Path to inline logo image file on disk")
    logo_blob: Optional[bytes]                  = Field(None, description="Raw logo image bytes (from DB BLOB)")
    signature: Optional[str]                    = Field(None, description="Signature text to append")
    smtp_config: Optional[Dict[str, Any]]       = Field(
        None,
        description=(
            "Pre-loaded SMTP config from the route layer. "
            "Expected keys: sender_email, sender_password, smtp_host, smtp_port, bcc. "
            "Falls back to environment variables for any missing keys."
        ),
    )


class EmailSenderOutput(BaseModel):
    success: bool
    message: str


# =============================================================================
# HELPERS
# =============================================================================

def _resolve_smtp(smtp_config: Optional[dict]) -> dict:
    """
    Merge caller-supplied smtp_config with environment variable fallbacks.
    Returns a fully-resolved dict ready for use.
    """
    cfg = smtp_config or {}
    return {
        "sender_email":    cfg.get("sender_email")    or os.getenv("EMAIL_ADDRESS"),
        "sender_password": cfg.get("sender_password") or os.getenv("EMAIL_PASSWORD"),
        "smtp_host":       cfg.get("smtp_host")       or os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "smtp_port":  int( cfg.get("smtp_port")       or os.getenv("SMTP_PORT", "587")),
        "bcc":             cfg.get("bcc")             or os.getenv("HUBSPOT_BCC_ADDRESS"),
    }


def _compute_read_sig(api_key: str, backend_id: str, email_id: int) -> str:
    """HMAC-SHA256 signature for the read-receipt tracking URL."""
    msg = f"{backend_id}{email_id}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


def _compute_optout_sig(api_key: str, backend_id: str, sender: str, receiver: str) -> str:
    """HMAC-SHA256 signature for the unsubscribe URL."""
    msg = f"{backend_id}{sender}{receiver}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


def _tracking_html_and_plain(email_id: int) -> tuple[str, str]:
    """
    Build the read-receipt confirmation button HTML and plain-text fallback.
    Returns ('', '') when microservice env vars are not configured.
    """
    base_url   = os.getenv("MICROSERVICE_BASE_URL")
    backend_id = os.getenv("MICROSERVICE_BACKEND_ID")
    api_key    = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not backend_id or not api_key:
        return "", ""

    sig = _compute_read_sig(api_key, backend_id, email_id)
    url = f"{base_url}/read-receipt/mark-read/{backend_id}/{email_id}?sig={sig}"

    html = f"""
<div style="margin-top:30px;text-align:center;">
  <a href="{url}"
     style="display:inline-block;padding:12px 30px;background-color:#667eea;
            color:white;text-decoration:none;border-radius:5px;
            font-weight:bold;font-size:14px;">
    Confirm Email Read
  </a>
</div>"""
    plain = f"\n\nClick here to confirm you've read this email: {url}\n"
    return html, plain


def _unsubscribe_html_and_plain(sender_email: str, receiver_email: str) -> tuple[str, str]:
    """
    Build a sleek unsubscribe footer link.
    Returns ('', '') when microservice env vars are not configured.
    """
    base_url   = os.getenv("MICROSERVICE_BASE_URL")
    backend_id = os.getenv("MICROSERVICE_BACKEND_ID")
    api_key    = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not backend_id or not api_key or not sender_email or not receiver_email:
        return "", ""

    sig          = _compute_optout_sig(api_key, backend_id, sender_email, receiver_email)
    sender_enc   = quote(sender_email, safe="")
    receiver_enc = quote(receiver_email, safe="")
    url          = f"{base_url}/optout/unsubscribe/{backend_id}/{sender_enc}/{receiver_enc}?sig={sig}"

    html = f"""
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;font-size:11px;color:#9ca3af;">
    Don't want to hear from us?
    <a href="{url}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
  </p>
</div>"""
    plain = f"\n\nTo unsubscribe: {url}\n"
    return html, plain


def _register_with_microservice(email_id: int) -> None:
    """Post the email ID to the read-receipt microservice after a successful send."""
    base_url = os.getenv("MICROSERVICE_BASE_URL")
    api_key  = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not api_key:
        return
    try:
        resp = requests.post(
            f"{base_url}/read-receipt/register",
            headers={"X-Api-Key": api_key, "Content-Type": "application/json"},
            json={"email_id": email_id},
            verify=False,
            timeout=5,
        )
        if resp.status_code == 200:
            print(f"  Microservice: email ID {email_id} registered.")
        else:
            print(f"  Microservice: registration failed {resp.status_code} {resp.text}")
    except Exception as exc:
        print(f"  Microservice: exception — {exc}")


def _logo_html(cid: str) -> str:
    """
    Return table-based logo HTML that renders consistently across all email
    clients, including iOS Mail which mis-positions images inside plain divs.

    Key fixes for iOS Mail:
      - <table> layout instead of <div> avoids iOS margin-collapse bugs
      - Explicit `width` attribute (not just CSS max-width) anchors the image
      - display:block eliminates the phantom descender gap below the image
      - border/outline/text-decoration reset prevents iOS blue-link wrapping
    """
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'role="presentation" style="margin-top:20px;">'
        f'<tr>'
        f'<td align="left" style="padding:0;">'
        f'<img src="cid:{cid}" alt="Company Logo" width="150" '
        f'style="display:block;max-width:150px;height:auto;'
        f'border:0;outline:none;text-decoration:none;">'
        f'</td>'
        f'</tr>'
        f'</table>'
    )


# =============================================================================
# MAIN TOOL
# =============================================================================

async def email_sender_tool(
    input: EmailSenderInput,
    user_id: Optional[int] = None,   # kept for call-site compatibility, not used for DB
) -> EmailSenderOutput:
    """
    Build and dispatch an outreach email over SMTP.

    Logo priority: logo_blob (DB BLOB) takes precedence over logo_path (file path).
    """
    try:
        # ── Validate ──────────────────────────────────────────────────────────
        if not input.recipient_email or "@" not in input.recipient_email:
            raise ValueError(f"Invalid recipient email: {input.recipient_email}")

        subject = (input.subject or "").strip() or f"Reaching out - {input.company_name}"

        # ── SMTP credentials ──────────────────────────────────────────────────
        cfg = _resolve_smtp(input.smtp_config)
        if not cfg["sender_email"] or not cfg["sender_password"]:
            raise ValueError(
                "Missing sender email or password. "
                "Configure SMTP settings in your profile or set EMAIL_ADDRESS / EMAIL_PASSWORD."
            )

        # ── Tracking pixel ────────────────────────────────────────────────────
        tracking_html, tracking_plain = ("", "")
        if input.email_id:
            tracking_html, tracking_plain = _tracking_html_and_plain(input.email_id)

        # ── Unsubscribe footer ────────────────────────────────────────────────
        sender_addr = input.sender_email or cfg["sender_email"]
        unsubscribe_html, unsubscribe_plain = _unsubscribe_html_and_plain(
            sender_addr, input.recipient_email
        )

        # ── Signature ─────────────────────────────────────────────────────────
        if input.signature:
            signature_html = f"<br><br>{input.signature.replace(chr(10), '<br>')}<br>"
        else:
            signature_html = "<br><br>Best regards,<br>"

        # ── Inline logo ───────────────────────────────────────────────────────
        # logo_blob (DB BLOB) takes precedence over logo_path (file path).
        # _logo_html() uses a <table> layout to fix iOS Mail left-edge drift.
        LOGO_CID  = "company_logo_001"
        logo_data = None
        logo_html = ""
        logo_filename = "logo.png"

        if input.logo_blob:
            logo_data     = input.logo_blob
            logo_filename = "logo.png"
            logo_html     = _logo_html(LOGO_CID)
        elif input.logo_path:
            logo_path = Path(input.logo_path)
            if logo_path.exists():
                try:
                    logo_data     = logo_path.read_bytes()
                    logo_filename = logo_path.name
                    logo_html     = _logo_html(LOGO_CID)
                except Exception as exc:
                    print(f"  Could not read logo: {exc}")
            else:
                print(f"  Logo not found: {input.logo_path}")

        # ── HTML body ─────────────────────────────────────────────────────────
        formatted = input.email_text.replace("\n", "<br>")
        html_body = f"""<!DOCTYPE html>
<html>
<head>
<style>
  body {{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
         line-height:1.6;color:#333;}}
  p    {{margin-bottom:20px;}}
</style>
</head>
<body>
{formatted}
{signature_html}
{logo_html}
{tracking_html}
{unsubscribe_html}
</body>
</html>"""

        # ── MIME assembly ─────────────────────────────────────────────────────
        root    = MIMEMultipart("mixed")
        root["Subject"] = subject
        root["From"]    = cfg["sender_email"]
        root["To"]      = input.recipient_email
        if cfg["bcc"]:
            root["Bcc"] = cfg["bcc"]

        related = MIMEMultipart("related")
        alt     = MIMEMultipart("alternative")
        alt.attach(MIMEText(input.email_text + tracking_plain + unsubscribe_plain, "plain", "utf-8"))
        alt.attach(MIMEText(html_body, "html", "utf-8"))
        related.attach(alt)

        if logo_data:
            img = MIMEImage(logo_data)
            img.add_header("Content-ID", f"<{LOGO_CID}>")
            img.add_header("Content-Disposition", "inline", filename=logo_filename)
            related.attach(img)

        root.attach(related)

        # ── File attachments ──────────────────────────────────────────────────
        for attachment in (input.attachments or []):
            file_path    = Path(attachment.file_path)
            display_name = attachment.display_name

            if not file_path.exists():
                print(f"  Attachment not found, skipping: {file_path}")
                continue

            print(f"  Attaching: {file_path} → {display_name}")
            try:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(file_path.read_bytes())
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename=\"{display_name}\"")
                part.add_header("Content-Type", "application/octet-stream", name=display_name)
                root.attach(part)
            except Exception as exc:
                print(f"  Error attaching {file_path} as {display_name}: {exc}")

        # ── Send ──────────────────────────────────────────────────────────────
        print(f"\n📧 Sending email")
        print(f"   To:      {input.recipient_email}")
        print(f"   Subject: {subject}")
        print(f"   BCC:     {cfg['bcc'] or 'none'}")
        print(f"   SMTP:    {cfg['smtp_host']}:{cfg['smtp_port']}")
        if input.attachments:
            print(f"   Attachments: {len(input.attachments)} file(s)")

        if cfg["smtp_port"] == 465:
            with smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"]) as server:
                server.login(cfg["sender_email"], cfg["sender_password"])
                server.send_message(root)
        else:
            with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"]) as server:
                server.starttls()
                server.login(cfg["sender_email"], cfg["sender_password"])
                server.send_message(root)

        print(f"   ✅ Sent to {input.recipient_email}")

        if input.email_id:
            _register_with_microservice(input.email_id)

        return EmailSenderOutput(success=True, message=f"Email sent to {input.recipient_email}")

    except ValueError as exc:
        print(f"❌ Validation: {exc}")
        return EmailSenderOutput(success=False, message=str(exc))

    except smtplib.SMTPAuthenticationError:
        msg = "SMTP authentication failed. Check your email credentials."
        print(f"❌ {msg}")
        return EmailSenderOutput(success=False, message=msg)

    except smtplib.SMTPException as exc:
        msg = f"SMTP error: {exc}"
        print(f"❌ {msg}")
        return EmailSenderOutput(success=False, message=msg)

    except Exception as exc:
        msg = f"Unexpected error: {exc}"
        print(f"❌ {msg}")
        return EmailSenderOutput(success=False, message=msg)