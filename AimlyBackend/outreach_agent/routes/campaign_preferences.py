"""
Campaign Preferences Management Routes - CORRECT NULL IMPLEMENTATION
Handles campaign-specific settings and configurations

THE CORRECT APPROACH:
════════════════════════════════════════════════════════════

1. Receive form values
2. TRACK which fields were sent (before normalization)
3. Normalize empty strings to None
4. Use tracking + normalized values in UPDATE

This ensures:
- Not sent (None) → Ignored (not in UPDATE)
- Sent empty ("") → Cleared to NULL (in UPDATE with None)
- Sent with value ("value") → Updated to value (in UPDATE with "value")

All fields are optional — any missing field falls back to a hardcoded default,
so the LLM prompt is never incomplete.

INHERIT GLOBAL SETTINGS:
- inherit_global_settings = 1 (default): Always use global settings, ignoring
  campaign-level values. If a global field is missing, fall back to defaults.
- inherit_global_settings = 0: Always use campaign-level values.
  If a campaign field is missing, fall back directly to defaults.

INHERIT GLOBAL ATTACHMENTS:
- inherit_global_attachments = 1 (default): Campaign also uses attachments
  defined in global_settings.
- inherit_global_attachments = 0: Only use campaign-level attachments.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import base64
from core.database.connection import get_connection
from routes.auth import get_current_user
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

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

# ──────────────────────────────────────────────────────────────────────────────
# Hard-coded fallback defaults used when a field is missing from both campaign
# preferences AND global settings (or when inherit_global_settings = 0).
# These ensure the LLM prompt is never missing critical context.
# ──────────────────────────────────────────────────────────────────────────────
FIELD_DEFAULTS = {
    "business_name":     "Our Company",
    "business_info":     "A professional services company",
    "goal":              "Generate leads and start a conversation",
    "value_prop":        "We provide high-quality solutions tailored to your needs",
    "cta":               "Schedule a quick call to learn more",
    "tone":              "Professional",
    "extras":            None,
    "email_instruction": None,
}


def get_mime_type_from_extension(extension: str) -> str:
    """Get MIME type from file extension."""
    mime_map = {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".gif":  "image/gif",
        ".webp": "image/webp",
    }
    return mime_map.get(extension.lower(), "application/octet-stream")


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    """
    Convert empty or whitespace-only strings to None.

    - None  → None  (unchanged)
    - ""    → None  (empty string becomes NULL)
    - "  "  → None  (whitespace-only becomes NULL)
    - "val" → "val" (leading/trailing whitespace trimmed)
    """
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
    bcc: Optional[str] = None
    business_name: Optional[str] = None
    business_info: Optional[str] = None
    goal: Optional[str] = None
    value_prop: Optional[str] = None
    tone: Optional[str] = None
    cta: Optional[str] = None
    extras: Optional[str] = None
    email_instruction: Optional[str] = None
    signature: Optional[str] = None
    template_email: Optional[str] = None
    logo_data: Optional[str] = None
    inherit_global_settings: Optional[int] = None
    inherit_global_attachments: Optional[int] = None
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ==================================================================================
# PUT /campaign/{campaign_id}/campaign_preference - Update campaign preferences
# ==================================================================================
@campaign_preferences_router.put(
    "/campaign/{campaign_id}/campaign_preference/",
    response_model=MessageResponse,
)
async def update_campaign_preferences(
    campaign_id: int,
    # ════════════════════════════════════════════════════════════════════════════
    # TEXT FIELDS
    # Update behavior:
    #   - Not sent        → IGNORED (unchanged in DB)
    #   - Sent empty ("") → CLEARED TO NULL
    #   - Sent with value → UPDATED to that value
    # ════════════════════════════════════════════════════════════════════════════
    bcc: Optional[str] = Form(None),
    business_name: Optional[str] = Form(None),
    business_info: Optional[str] = Form(None),
    goal: Optional[str] = Form(None),
    value_prop: Optional[str] = Form(None),
    tone: Optional[str] = Form(None),
    cta: Optional[str] = Form(None),
    extras: Optional[str] = Form(None),
    email_instruction: Optional[str] = Form(None),
    signature: Optional[str] = Form(None),
    template_email: Optional[str] = Form(None),
    # ════════════════════════════════════════════════════════════════════════════
    # NUMERIC FIELDS
    # ════════════════════════════════════════════════════════════════════════════
    inherit_global_settings: Optional[int] = Form(None),
    inherit_global_attachments: Optional[int] = Form(None),
    # ════════════════════════════════════════════════════════════════════════════
    # LOGO FILE
    # ════════════════════════════════════════════════════════════════════════════
    logo: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Update campaign preferences for a specific campaign.

    Uses a TWO-STEP APPROACH for text fields:
      STEP 1: Track which fields were SENT (before normalization)
      STEP 2: Normalize values & use tracking for the UPDATE clause

    This correctly handles:
      - Not sent  → Don't add to UPDATE (unchanged)
      - Sent empty → Add to UPDATE with NULL
      - Sent value → Add to UPDATE with value
    """
    user_id = current_user["user_id"]

    # ────────────────────────────────────────────────────────────────────────────
    # STEP 1: TRACK WHICH TEXT FIELDS WERE SENT (before normalization)
    # ────────────────────────────────────────────────────────────────────────────
    bcc_sent               = bcc is not None
    business_name_sent     = business_name is not None
    business_info_sent     = business_info is not None
    goal_sent              = goal is not None
    value_prop_sent        = value_prop is not None
    tone_sent              = tone is not None
    cta_sent               = cta is not None
    extras_sent            = extras is not None
    email_instruction_sent = email_instruction is not None
    signature_sent         = signature is not None
    template_email_sent    = template_email is not None

    # ────────────────────────────────────────────────────────────────────────────
    # STEP 2: NORMALIZE TEXT FIELDS (empty string → None → SQL NULL)
    # ────────────────────────────────────────────────────────────────────────────
    bcc               = normalize_text_field(bcc)
    business_name     = normalize_text_field(business_name)
    business_info     = normalize_text_field(business_info)
    goal              = normalize_text_field(goal)
    value_prop        = normalize_text_field(value_prop)
    tone              = normalize_text_field(tone)
    cta               = normalize_text_field(cta)
    extras            = normalize_text_field(extras)
    email_instruction = normalize_text_field(email_instruction)
    signature         = normalize_text_field(signature)
    template_email    = normalize_text_field(template_email)

    # ────────────────────────────────────────────────────────────────────────────
    # VALIDATION
    # ────────────────────────────────────────────────────────────────────────────
    if tone is not None and tone not in VALID_TONES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tone. Choose from: {', '.join(sorted(VALID_TONES))}",
        )

    if inherit_global_settings is not None and inherit_global_settings not in [0, 1]:
        raise HTTPException(
            status_code=400,
            detail="inherit_global_settings must be 0 or 1",
        )

    if inherit_global_attachments is not None and inherit_global_attachments not in [0, 1]:
        raise HTTPException(
            status_code=400,
            detail="inherit_global_attachments must be 0 or 1",
        )

    # ────────────────────────────────────────────────────────────────────────────
    # LOGO HANDLING
    # ────────────────────────────────────────────────────────────────────────────
    logo_blob      = None
    logo_mime_type = None

    if logo is not None:
        if logo.filename and logo.size > 0:
            # Logo file with content → validate and store
            if logo.size > MAX_IMAGE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail="Logo file size too large (max 5MB)",
                )

            file_extension = (
                f".{logo.filename.split('.')[-1].lower()}"
                if "." in logo.filename
                else ""
            )
            if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid logo file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}",
                )

            logo_blob      = await logo.read()
            logo_mime_type = get_mime_type_from_extension(file_extension)
        else:
            # Empty logo file → clear logo (set to NULL)
            logo_blob      = None
            logo_mime_type = None

    # ────────────────────────────────────────────────────────────────────────────
    # DATABASE OPERATIONS
    # ────────────────────────────────────────────────────────────────────────────
    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify campaign belongs to user
        cursor.execute(
            "SELECT id FROM campaigns WHERE id = ? AND user_id = ?",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Check if preferences row already exists
        cursor.execute(
            "SELECT id FROM campaign_preferences WHERE campaign_id = ?",
            (campaign_id,),
        )
        existing = cursor.fetchone()

        try:
            if existing:
                # ────────────────────────────────────────────────────────────
                # UPDATE existing preferences (only sent fields)
                # ────────────────────────────────────────────────────────────
                update_fields = []
                update_values = []

                # TEXT FIELDS — use sent-tracking + normalized value
                if bcc_sent:
                    update_fields.append("bcc = ?")
                    update_values.append(bcc)

                if business_name_sent:
                    update_fields.append("business_name = ?")
                    update_values.append(business_name)

                if business_info_sent:
                    update_fields.append("business_info = ?")
                    update_values.append(business_info)

                if goal_sent:
                    update_fields.append("goal = ?")
                    update_values.append(goal)

                if value_prop_sent:
                    update_fields.append("value_prop = ?")
                    update_values.append(value_prop)

                if tone_sent:
                    update_fields.append("tone = ?")
                    update_values.append(tone)

                if cta_sent:
                    update_fields.append("cta = ?")
                    update_values.append(cta)

                if extras_sent:
                    update_fields.append("extras = ?")
                    update_values.append(extras)

                if email_instruction_sent:
                    update_fields.append("email_instruction = ?")
                    update_values.append(email_instruction)

                if signature_sent:
                    update_fields.append("signature = ?")
                    update_values.append(signature)

                if template_email_sent:
                    update_fields.append("template_email = ?")
                    update_values.append(template_email)

                # NUMERIC FIELDS — standard None check
                if inherit_global_settings is not None:
                    update_fields.append("inherit_global_settings = ?")
                    update_values.append(inherit_global_settings)

                if inherit_global_attachments is not None:
                    update_fields.append("inherit_global_attachments = ?")
                    update_values.append(inherit_global_attachments)

                # LOGO FIELD
                if logo is not None:
                    update_fields.append("logo = ?")
                    update_values.append(logo_blob)
                    update_fields.append("logo_mime_type = ?")
                    update_values.append(logo_mime_type)

                if update_fields:
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
                    update_values.append(campaign_id)
                    query = (
                        f"UPDATE campaign_preferences "
                        f"SET {', '.join(update_fields)} "
                        f"WHERE campaign_id = ?"
                    )
                    cursor.execute(query, update_values)

            else:
                # ────────────────────────────────────────────────────────────
                # INSERT new preferences row
                # ────────────────────────────────────────────────────────────
                cursor.execute(
                    """
                    INSERT INTO campaign_preferences (
                        campaign_id, bcc, business_name, business_info, goal, value_prop,
                        tone, cta, extras, email_instruction, signature, template_email,
                        logo, logo_mime_type,
                        inherit_global_settings,
                        inherit_global_attachments
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        campaign_id,
                        bcc,
                        business_name,
                        business_info,
                        goal,
                        value_prop,
                        tone,
                        cta,
                        extras,
                        email_instruction,
                        signature,
                        template_email,
                        logo_blob,
                        logo_mime_type,
                        inherit_global_settings,
                        inherit_global_attachments,
                    ),
                )

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Campaign preferences updated successfully")


class TemplateEmailResponse(BaseModel):
    subject: str
    content: str
    success: bool = True


# ==================================================================================
# POST /campaign/{campaign_id}/campaign_preference/generate-template
# FIX: Changed from `async def` to `def` so asyncio.new_event_loop() works correctly.
#      Using async def inside FastAPI causes a RuntimeError because FastAPI's event
#      loop is already running — new_event_loop().run_until_complete() can't nest.
#      Plain `def` routes run in a thread pool with no active event loop, so it works.
# ==================================================================================
@campaign_preferences_router.post(
    "/campaign/{campaign_id}/campaign_preference/generate-template/",
    response_model=TemplateEmailResponse,
)
def generate_template_email(
    campaign_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a reusable email template using AI.

    Field resolution order when inherit_global_settings = 1 (default):
      1. Global settings  (always used, campaign-level ignored)
      2. Hard-coded default

    Field resolution order when inherit_global_settings = 0:
      1. Campaign preferences
      2. Hard-coded default
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        # Verify campaign belongs to user
        cursor.execute(
            "SELECT id FROM campaigns WHERE id = ? AND user_id = ?",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        # Fetch LLM credentials
        cursor.execute(
            "SELECT llm_api_key, llm_model FROM user_keys WHERE user_id = ?",
            (user_id,),
        )
        key_row = cursor.fetchone()
        if not key_row or not key_row["llm_api_key"]:
            raise HTTPException(
                status_code=400,
                detail="No LLM API key configured. Please add one in Settings → API Keys.",
            )

        llm_config = {
            "api_key": key_row["llm_api_key"],
            "model":   key_row["llm_model"] or "gemini-2.0-flash",
        }

        # Fetch campaign preferences (includes inherit_global_settings flag)
        cursor.execute(
            """
            SELECT business_name, business_info, goal, value_prop,
                   tone, cta, extras, email_instruction, signature,
                   inherit_global_settings
            FROM campaign_preferences
            WHERE campaign_id = ?
            """,
            (campaign_id,),
        )
        campaign_prefs = cursor.fetchone()

        # ── Determine whether to consult global settings ─────────────────────
        # inherit_global_settings defaults to 1 in the DB schema.
        # Treat NULL as True (inheriting) for safety.
        if campaign_prefs is not None:
            inherit_val    = campaign_prefs["inherit_global_settings"]
            should_inherit = (inherit_val is None or inherit_val == 1)
        else:
            # No campaign prefs row at all → inherit by default
            should_inherit = True

        # Only hit the DB for global settings when needed
        global_prefs = None
        if should_inherit:
            cursor.execute(
                """
                SELECT business_name, business_info, goal, value_prop, tone,
                       cta, extras, email_instruction, signature
                FROM global_settings
                WHERE user_id = ?
                """,
                (user_id,),
            )
            global_prefs = cursor.fetchone()

    # ── Value resolution helper ───────────────────────────────────────────────
    def get_value(field_name: str) -> Optional[str]:
        """
        Resolution order:

        inherit_global_settings = True:
          1. Global settings  (campaign-level ignored)
          2. Hard-coded default

        inherit_global_settings = False:
          1. Campaign preferences
          2. Hard-coded default
        """
        if should_inherit:
            if global_prefs and global_prefs[field_name]:
                return global_prefs[field_name]
            return FIELD_DEFAULTS.get(field_name)
        else:
            if campaign_prefs and campaign_prefs[field_name]:
                return campaign_prefs[field_name]
            return FIELD_DEFAULTS.get(field_name)

    # ── Resolve all context values ────────────────────────────────────────────
    resolved_business_name = get_value("business_name")
    resolved_business_info = get_value("business_info")
    resolved_goal          = get_value("goal")
    resolved_value_prop    = get_value("value_prop")
    resolved_cta           = get_value("cta")
    resolved_tone          = get_value("tone")
    resolved_extras        = get_value("extras")
    resolved_instruction   = get_value("email_instruction")

    # ── Build the context block shown to the LLM ─────────────────────────────
    context_lines = [
        f"- Business Name:       {resolved_business_name}",
        f"- About the Business:  {resolved_business_info}",
        f"- Campaign Goal:       {resolved_goal}",
        f"- Value Proposition:   {resolved_value_prop}",
        f"- Call to Action:      {resolved_cta}",
        f"- Desired Tone:        {resolved_tone}",
    ]
    if resolved_extras:
        context_lines.append(f"- Additional Context:  {resolved_extras}")
    if resolved_instruction:
        context_lines.append(f"- Special Instructions: {resolved_instruction}")

    context_block = "\n".join(context_lines)

    instruction = f"""You are an expert B2B cold email copywriter. Your task is to write a \
reusable outreach email template that will be personalised per recipient at send time.

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
4. Body: 3–5 sentences maximum. Be concise and direct.
5. Close with the Call to Action above. One sentence only.
6. Do NOT include a sign-off or signature (handled separately by the system).
7. Tone must match exactly: {resolved_tone}
8. Output ONLY the email. No explanations, no commentary, no markdown code fences.
   Start your response directly with "SUBJECT:".

════════════════════════════════════════════════════════════
EXACT OUTPUT FORMAT  (replicate this structure precisely)
════════════════════════════════════════════════════════════
SUBJECT: <your subject line>

<email body — plain text, no bullet points, no headers>

════════════════════════════════════════════════════════════
EXAMPLE  (illustrative only — do NOT copy the content)
════════════════════════════════════════════════════════════
SUBJECT: A quick idea for {{{{company_name}}}}

{{{{company_name}}}} caught our attention — your rapid expansion across new markets is impressive.

At Acme Corp, we help scaling companies cut customer onboarding time by up to 40% using \
automated workflow tools that plug straight into your existing stack — no migration required.

Would it be worth a 20-minute call to explore whether we could do the same for {{{{company_name}}}}?
════════════════════════════════════════════════════════════

Now write the template for {resolved_business_name}. Remember: output ONLY the email, \
starting with SUBJECT:
"""

    # ── Call the LLM (sync route → new_event_loop is safe here) ─────────────
    try:
        loop = asyncio.new_event_loop()
        email_result, _ = loop.run_until_complete(
            svc_generate_email(
                company_name="[COMPANY_NAME]",
                user_instruction=instruction,
                llm_config=llm_config,
                company_details=None,
            )
        )
        loop.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Template generation failed: {str(e)}",
        )

    subject = email_result.get("subject", "").replace("[COMPANY_NAME]", "{{company_name}}")
    content = email_result.get("content", "").replace("[COMPANY_NAME]", "{{company_name}}")

    # Strip any rogue SUBJECT: lines the LLM may have leaked into the body
    import re
    content = re.sub(r"(?im)^SUBJECT:.*\n?", "", content).strip()

    # Guarantee at least one {{company_name}} placeholder in the output
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
    """Get campaign preferences; logo BLOB is returned as a base64 data URL."""
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM campaigns WHERE id = ? AND user_id = ?",
            (campaign_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Campaign not found")

        cursor.execute(
            "SELECT * FROM campaign_preferences WHERE campaign_id = ?",
            (campaign_id,),
        )
        preferences = cursor.fetchone()

    if not preferences:
        raise HTTPException(status_code=404, detail="No campaign preferences found")

    preferences_dict = dict(preferences)

    # Convert logo BLOB → base64 data URL
    if preferences_dict.get("logo") and preferences_dict.get("logo_mime_type"):
        try:
            base64_data = base64.b64encode(preferences_dict["logo"]).decode("utf-8")
            preferences_dict["logo_data"] = (
                f"data:{preferences_dict['logo_mime_type']};base64,{base64_data}"
            )
        except Exception as e:
            print(f"Error encoding logo: {e}")
            preferences_dict["logo_data"] = None
    else:
        preferences_dict["logo_data"] = None

    # Remove raw BLOB from the response dict before constructing Pydantic model
    preferences_dict.pop("logo", None)

    return CampaignPreferencesResponse(**preferences_dict)