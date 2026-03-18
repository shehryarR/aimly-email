"""
email_service.py — Email generation and sending service.

Pure logic layer — zero database operations.
All DB reads/writes and config loading are the caller's (route layer's) responsibility.
UPDATED: Accepts AttachmentInfo objects and passes them through to email_sender_tool
UPDATED: Accepts logo_blob (raw bytes) in addition to logo_path
"""
from sub_agents.email_writer.agent import run_email_writer_agent, EmailWriterInput
from tools.email_sender_tool import email_sender_tool, EmailSenderInput, AttachmentInfo
from typing import List, Optional


# =============================================================================
# GENERATION
# =============================================================================

async def generate_email(
    company_name: str,
    user_instruction: str,
    llm_config: dict,
    company_details: str = None,
    html_email: bool = False,
    progress_callback=None,
):
    """
    Generate a personalised outreach email via the email-writer sub-agent.

    Args:
        company_name:      Recipient company name.
        user_instruction:  LLM prompt / instruction string.
        llm_config:        Pre-loaded dict with keys: api_key, model.
        company_details:   Pre-researched company context (optional).
        html_email:        If True, the LLM generates a styled HTML snippet instead of plain text.
        progress_callback: Optional callable for streaming status updates.

    Returns:
        (email_dict, company_details)
        email_dict keys: 'subject' (str), 'content' (str)
    """
    if progress_callback:
        if company_details:
            progress_callback("⏳ Generating personalized email with research...")
        else:
            progress_callback("⏳ Generating email (no research available)...")

    email_result = await run_email_writer_agent(
        inputs=EmailWriterInput(
            company_name=company_name,
            user_instruction=user_instruction,
            company_summary=company_details,
            html_email=html_email,
            llm_config=llm_config,
        )
    )

    if progress_callback:
        progress_callback("✅ Email generation complete!")

    return email_result, company_details


# =============================================================================
# SENDING
# =============================================================================

async def send_email(
    company_name: str,
    company_email: str,
    email_body: str,
    email_id: int = None,
    subject: str = None,
    attachments: Optional[List[AttachmentInfo]] = None,
    inline_images: Optional[List[AttachmentInfo]] = None,
    progress_callback=None,
    logo_path: str = None,
    logo_blob: Optional[bytes] = None,
    signature: str = None,
    smtp_config: dict = None,
    html_email: bool = False,
):
    """
    Send an outreach email via the email-sender tool.

    No database calls are made here. The caller is responsible for:
      • Loading smtp_config before calling
      • Persisting the recipient address before calling
      • Updating email status after this returns

    Args:
        company_name:   Display name of the recipient company.
        company_email:  Delivery address.
        email_body:     HTML snippet (when html_email=True) or plain-text body.
        email_id:       DB row ID forwarded to the tool for the tracking pixel.
        subject:        Subject line. Falls back to "Reaching out - <n>".
        attachments:    List of AttachmentInfo objects with file_path and display_name.
        logo_path:      Optional path to a logo image file on disk.
        logo_blob:      Optional raw logo image bytes (used when logo is stored as BLOB in DB).
        signature:      Optional signature string to embed.
        smtp_config:    Pre-loaded SMTP dict with keys:
                            sender_email, sender_password,
                            smtp_host, smtp_port, bcc.
        html_email:     If True, email_body is treated as an HTML snippet and sent as-is
                        in the HTML part (no <br> conversion). Plain-text part is stripped.
        progress_callback: Optional callable for streaming status updates.

    Returns:
        EmailSenderOutput  (attributes: success: bool, message: str)
    """
    try:
        if progress_callback:
            progress_callback("⏳ Preparing to send email...")

        print(f"📧 Sending to {company_email} for {company_name}")

        if not subject:
            subject = f"Reaching out - {company_name}"
            print(f"  No subject provided, using fallback: {subject}")

        print(f"  email_id={email_id}  attachments={len(attachments) if attachments else 0} file(s)")

        send_result = await email_sender_tool(
            EmailSenderInput(
                recipient_email=company_email,
                email_text=email_body,
                email_id=email_id,
                company_name=company_name,
                subject=subject,
                attachments=attachments,
                inline_images=inline_images,
                logo_path=logo_path,
                logo_blob=logo_blob,
                signature=signature,
                smtp_config=smtp_config,
                html_email=html_email,
            ),
        )

        print(f"  Result: success={send_result.success}, message={send_result.message}")

        if progress_callback:
            if send_result.success:
                progress_callback("✅ Email sent successfully!")
            else:
                progress_callback(f"❌ Failed: {send_result.message}")

        return send_result

    except Exception as exc:
        error_msg = f"Error sending email: {exc}"
        print(f"❌ {error_msg}")
        if progress_callback:
            progress_callback(f"❌ {error_msg}")

        class _FailedResult:
            success = False
            message = error_msg

        return _FailedResult()