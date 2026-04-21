from datetime import datetime
"""
Campaign Preferences Management Routes
Handles campaign-specific settings and configurations.

After brand migration:
  Removed: business_name, business_info, logo, logo_mime_type, signature
  Renamed: email_instruction → writing_guidelines, extras → additional_notes
  Added:   brand_id (nullable FK → brands)
  LLM model now fetched from global_settings instead of user_keys.

THE CORRECT NULL APPROACH:
════════════════════════════════════════════════════════════
1. Field NOT SENT  → Ignored (not in UPDATE clause) → Database: UNCHANGED
2. Field SENT EMPTY → Converted to NULL → Database: SET TO NULL
3. Field SENT WITH VALUE → Added to UPDATE with value → Database: SET TO VALUE

INHERIT GLOBAL SETTINGS:
- inherit_global_settings = 1 (default): Use global settings, ignoring campaign-level values.
- inherit_global_settings = 0: Use campaign-level values, fall back to defaults.

INHERIT GLOBAL ATTACHMENTS:
- inherit_global_attachments = 1 (default): Use global attachments.
- inherit_global_attachments = 0: Only use campaign-level attachments.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, Form, Request
from pydantic import BaseModel
from typing import Optional
from core.database.connection import get_connection
from routes.auth import get_current_user
from routes.utils.crypto import _read_cookie_key, _LLM_COOKIE
from services.email_service import generate_email as svc_generate_email

campaign_preferences_router = APIRouter(tags=["Campaign Preferences"])

VALID_TONES = {
    "Professional",
    "Professional but friendly",
    "Enthusiastic",
    "Concise",
    "Formal",
    "Casual",
}

# ──────────────────────────────────────────────────────────────────────────────
# Hard-coded fallback defaults — LLM prompt is never missing critical context.
# ──────────────────────────────────────────────────────────────────────────────
FIELD_DEFAULTS = {
    "goal":               "Generate leads and start a conversation",
    "value_prop":         "We provide high-quality solutions tailored to your needs",
    "cta":                "Schedule a quick call to learn more",
    "tone":               "Professional",
    "writing_guidelines": None,
    "additional_notes":   None,
}


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────────────────────────────────────

class CampaignPreferencesResponse(BaseModel):
    id: int
    campaign_id: int
    brand_id: Optional[int] = None
    bcc: Optional[str] = None
    goal: Optional[str] = None
    value_prop: Optional[str] = None
    tone: Optional[str] = None
    cta: Optional[str] = None
    writing_guidelines: Optional[str] = None
    additional_notes: Optional[str] = None
    template_email: Optional[str] = None
    template_html_email: Optional[int] = None
    inherit_global_settings: Optional[int] = None
    inherit_global_attachments: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ==================================================================================
# PUT /campaign/{campaign_id}/campaign_preference
# ==================================================================================
@campaign_preferences_router.put(
    "/campaign/{campaign_id}/campaign_preference/",
    response_model=MessageResponse,
)
async def update_campaign_preferences(
    campaign_id: int,
    request: Request,
    # ── Text fields ──────────────────────────────────────────────────────────
    bcc: Optional[str] = Form(None),
    goal: Optional[str] = Form(None),
    value_prop: Optional[str] = Form(None),
    tone: Optional[str] = Form(None),
    cta: Optional[str] = Form(None),
    writing_guidelines: Optional[str] = Form(None),
    additional_notes: Optional[str] = Form(None),
    template_email: Optional[str] = Form(None),
    # ── Numeric / flag fields ─────────────────────────────────────────────────
    brand_id: Optional[int] = Form(None),
    inherit_global_settings: Optional[int] = Form(None),
    inherit_global_attachments: Optional[int] = Form(None),
    template_html_email: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Update campaign preferences for a specific campaign.

    Text fields: always sent by the frontend on every save; None = clear to NULL.
    Numeric/flag fields: only updated when explicitly sent.
    brand_id: sent as integer (or 0 to clear → stored as NULL).
    """
    user_id = current_user["user_id"]

    # ── Track which optional fields were explicitly sent ──────────────────────
    inherit_global_settings_sent    = inherit_global_settings is not None
    inherit_global_attachments_sent = inherit_global_attachments is not None
    template_html_email_sent        = template_html_email is not None
    brand_id_sent                   = brand_id is not None
    _raw_form = await request.form()
    template_email_sent = "template_email" in _raw_form

    # ── Normalize text fields ─────────────────────────────────────────────────
    bcc                = normalize_text_field(bcc)
    goal               = normalize_text_field(goal)
    value_prop         = normalize_text_field(value_prop)
    tone               = normalize_text_field(tone)
    cta                = normalize_text_field(cta)
    writing_guidelines = normalize_text_field(writing_guidelines)
    additional_notes   = normalize_text_field(additional_notes)
    template_email     = normalize_text_field(template_email)

    # ── Validation ────────────────────────────────────────────────────────────
    if tone is not None and tone not in VALID_TONES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tone. Choose from: {', '.join(sorted(VALID_TONES))}",
        )
    if inherit_global_settings is not None and inherit_global_settings not in [0, 1]:
        raise HTTPException(status_code=400, detail="inherit_global_settings must be 0 or 1")
    if inherit_global_attachments is not None and inherit_global_attachments not in [0, 1]:
        raise HTTPException(status_code=400, detail="inherit_global_attachments must be 0 or 1")
    if template_html_email is not None and template_html_email not in [0, 1]:
        raise HTTPException(status_code=400, detail="template_html_email must be 0 or 1")

    # brand_id=0 means "clear the brand" — store as NULL
    resolved_brand_id = None if (not brand_id) else brand_id

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute(
            "SELECT id FROM campaign_preferences WHERE campaign_id = %s", (campaign_id,)
        )
        existing = cursor.fetchone()

        try:
            if existing:
                update_fields = []
                update_values = []

                # Text fields — frontend sends all on every save
                for col, val in [
                    ("bcc",                bcc),
                    ("goal",               goal),
                    ("value_prop",         value_prop),
                    ("tone",               tone),
                    ("cta",                cta),
                    ("writing_guidelines", writing_guidelines),
                    ("additional_notes",   additional_notes),
                ]:
                    update_fields.append(f"{col} = %s")
                    update_values.append(val)

                # Selectively updated fields
                if template_email_sent:
                    update_fields.append("template_email = %s")
                    update_values.append(template_email)

                if template_html_email_sent:
                    update_fields.append("template_html_email = %s")
                    update_values.append(template_html_email)

                if inherit_global_settings_sent:
                    update_fields.append("inherit_global_settings = %s")
                    update_values.append(inherit_global_settings)

                if inherit_global_attachments_sent:
                    update_fields.append("inherit_global_attachments = %s")
                    update_values.append(inherit_global_attachments)

                if brand_id_sent:
                    update_fields.append("brand_id = %s")
                    update_values.append(resolved_brand_id)

                if update_fields:
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
                    update_values.append(campaign_id)
                    cursor.execute(
                        f"UPDATE campaign_preferences SET {', '.join(update_fields)} WHERE campaign_id = %s",
                        update_values,
                    )

            else:
                cursor.execute(
                    """
                    INSERT INTO campaign_preferences (
                        campaign_id, brand_id, bcc, goal, value_prop, tone, cta,
                        writing_guidelines, additional_notes,
                        template_email, template_html_email,
                        inherit_global_settings, inherit_global_attachments
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        campaign_id, resolved_brand_id, bcc, goal, value_prop, tone, cta,
                        writing_guidelines, additional_notes,
                        template_email, template_html_email,
                        inherit_global_settings, inherit_global_attachments,
                    ),
                )

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Campaign preferences updated successfully")


# ==================================================================================
# POST /campaign/{campaign_id}/campaign_preference/generate-template
# ==================================================================================

class TemplateEmailResponse(BaseModel):
    subject: str
    content: str
    success: bool = True


@campaign_preferences_router.post(
    "/campaign/{campaign_id}/campaign_preference/generate-template/",
    response_model=TemplateEmailResponse,
)
def generate_template_email(
    campaign_id: int,
    http_request: Request,
    html_email: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a reusable email template using AI.

    Field resolution (inherit_global_settings = 1 default):
      1. Global settings  → 2. Hard-coded default

    Field resolution (inherit_global_settings = 0):
      1. Campaign preferences → 2. Hard-coded default

    LLM model is read from global_settings (not user_keys).
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # ── LLM credentials: key from cookie, model from global_settings ─────
        llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)
        if not llm_api_key:
            raise HTTPException(
                status_code=400,
                detail="No LLM API key configured. Please add one in Settings.",
            )

        cursor.execute("SELECT llm_model FROM global_settings WHERE user_id = %s", (user_id,))
        gs_row = cursor.fetchone()
        llm_config = {
            "api_key": llm_api_key,
            "model":   (gs_row["llm_model"] if gs_row else None) or "gemini-2.0-flash",
        }

        # ── Campaign preferences ──────────────────────────────────────────────
        cursor.execute(
            """
            SELECT goal, value_prop, tone, cta,
                   writing_guidelines, additional_notes, inherit_global_settings
            FROM campaign_preferences WHERE campaign_id = %s
            """,
            (campaign_id,),
        )
        campaign_prefs = cursor.fetchone()

        inherit_val    = campaign_prefs["inherit_global_settings"] if campaign_prefs else None
        should_inherit = (inherit_val is None or inherit_val == 1)

        global_prefs = None
        if should_inherit:
            cursor.execute(
                """
                SELECT goal, value_prop, tone, cta, writing_guidelines, additional_notes
                FROM global_settings WHERE user_id = %s
                """,
                (user_id,),
            )
            global_prefs = cursor.fetchone()

        # ── Also fetch brand for business_name / business_info ───────────────
        brand = None
        if campaign_prefs and campaign_prefs.get("inherit_global_settings") == 0:
            # Use campaign's linked brand
            cursor.execute(
                """
                SELECT b.business_name, b.business_info
                FROM brands b
                JOIN campaign_preferences cp ON cp.brand_id = b.id
                WHERE cp.campaign_id = %s
                """,
                (campaign_id,),
            )
        else:
            # Use user's default brand
            cursor.execute(
                "SELECT business_name, business_info FROM brands WHERE user_id = %s AND is_default = 1",
                (user_id,),
            )
        brand = cursor.fetchone()

    # ── Value resolution ──────────────────────────────────────────────────────
    def get_value(field_name: str) -> Optional[str]:
        if should_inherit:
            val = global_prefs[field_name] if global_prefs else None
        else:
            val = campaign_prefs[field_name] if campaign_prefs else None
        return val if val else FIELD_DEFAULTS.get(field_name)

    resolved_business_name = (brand["business_name"] if brand else None) or "Our Company"
    resolved_business_info = (brand["business_info"] if brand else None) or "A professional services company"
    resolved_goal          = get_value("goal")
    resolved_value_prop    = get_value("value_prop")
    resolved_cta           = get_value("cta")
    resolved_tone          = get_value("tone")
    resolved_guidelines    = get_value("writing_guidelines")
    resolved_notes         = get_value("additional_notes")

    # ── Build context block ───────────────────────────────────────────────────
    context_lines = [
        f"- Business Name:       {resolved_business_name}",
        f"- About the Business:  {resolved_business_info}",
        f"- Campaign Goal:       {resolved_goal}",
        f"- Value Proposition:   {resolved_value_prop}",
        f"- Call to Action:      {resolved_cta}",
        f"- Desired Tone:        {resolved_tone}",
    ]
    if resolved_notes:
        context_lines.append(f"- Additional Context:  {resolved_notes}")
    if resolved_guidelines:
        context_lines.append(f"- Writing Guidelines: {resolved_guidelines}")

    context_block = "\n".join(context_lines)

    common_rules = f"""
════════════════════════════════════════════════════════════
BUSINESS CONTEXT
════════════════════════════════════════════════════════════
{context_block}

════════════════════════════════════════════════════════════
RULES  (follow every one strictly)
════════════════════════════════════════════════════════════
1. Use EXACTLY ONE placeholder: {{{{company_name}}}}
   - It must appear at least once in the subject OR body.
   - Do NOT invent any other placeholders (e.g. no {{{{first_name}}}}, {{{{industry}}}}).
2. Subject line: personalised, under 10 words, curiosity-driving.
3. Opening line: reference {{{{company_name}}}} or lead with a sharp hook — never "Dear Sir/Madam".
4. Close with the Call to Action above. One sentence only.
5. Do NOT include a sign-off or signature (handled separately by the system).
6. Tone must match exactly: {resolved_tone}

════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════
SUBJECT: <your subject line>

CONTENT:
<email body here>

Now write the template for {resolved_business_name}."""

    if html_email:
        instruction = f"""You are an expert B2B email designer. Write a reusable HTML outreach email template personalised per recipient at send time.
{common_rules}

════════════════════════════════════════════════════════════
HTML RULES
════════════════════════════════════════════════════════════
- CONTENT must be a complete self-contained HTML snippet (NOT a full <!DOCTYPE> page).
- Use only inline CSS — no <style> blocks, no external stylesheets.
- Clean professional layout: font Arial/sans-serif, 15px, line-height 1.6, color #333333.
- Separate sections with <div> or <p> tags, margin-bottom: 16px.
- CTA should be a styled <a> button, e.g.:
  <a href="#" style="display:inline-block;padding:10px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Book a Call</a>
- Do NOT include <html>, <head>, <body>, or <style> tags.
- Body: 3–5 sentences/sections maximum. Be concise and direct.
"""
    else:
        instruction = f"""You are an expert B2B cold email copywriter. Write a reusable plain-text outreach email template personalised per recipient at send time.
{common_rules}

════════════════════════════════════════════════════════════
PLAIN TEXT RULES
════════════════════════════════════════════════════════════
- Body: 3–5 sentences maximum. Be concise and direct.
- No bullet points, no headers, no HTML tags.
"""

    try:
        loop = asyncio.new_event_loop()
        email_result, _ = loop.run_until_complete(
            svc_generate_email(
                company_name="[COMPANY_NAME]",
                user_instruction=instruction,
                llm_config=llm_config,
                company_details=None,
                html_email=False,
                raw_prompt=True,
            )
        )
        loop.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template generation failed: {str(e)}")

    subject = email_result.get("subject", "").replace("[COMPANY_NAME]", "{{company_name}}")
    content = email_result.get("content", "").replace("[COMPANY_NAME]", "{{company_name}}")

    import re
    content = re.sub(r"(?im)^SUBJECT:.*\n?", "", content).strip()

    if "{{company_name}}" not in subject and "{{company_name}}" not in content:
        content = "{{company_name}}\n\n" + content

    return TemplateEmailResponse(subject=subject, content=content)


# ==================================================================================
# GET /campaign/{campaign_id}/campaign_preference
# ==================================================================================
@campaign_preferences_router.get(
    "/campaign/{campaign_id}/campaign_preference/",
    response_model=CampaignPreferencesResponse,
)
def get_campaign_preferences(
    campaign_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get campaign preferences for a campaign."""
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute(
            "SELECT * FROM campaign_preferences WHERE campaign_id = %s",
            (campaign_id,),
        )
        preferences = cursor.fetchone()

    if not preferences:
        raise HTTPException(status_code=404, detail="No campaign preferences found")

    p = dict(preferences)

    return CampaignPreferencesResponse(
        id=p["id"],
        campaign_id=p["campaign_id"],
        brand_id=p.get("brand_id"),
        bcc=p.get("bcc"),
        goal=p.get("goal"),
        value_prop=p.get("value_prop"),
        tone=p.get("tone"),
        cta=p.get("cta"),
        writing_guidelines=p.get("writing_guidelines"),
        additional_notes=p.get("additional_notes"),
        template_email=p.get("template_email"),
        template_html_email=p.get("template_html_email"),
        inherit_global_settings=p.get("inherit_global_settings"),
        inherit_global_attachments=p.get("inherit_global_attachments"),
        created_at=p["created_at"],
        updated_at=p["updated_at"],
    )