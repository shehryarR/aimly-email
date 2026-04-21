from datetime import datetime
"""
Global Settings Management Routes
Handles user's global default settings that apply to all campaigns.

Columns managed here (after brand migration):
  bcc, goal, value_prop, tone, cta, writing_guidelines, additional_notes, llm_model

Removed (moved to brands): business_name, business_info, logo, logo_mime_type, signature
Renamed: email_instruction → writing_guidelines, extras → additional_notes
Added:   llm_model (plain string, not inherited by campaigns)

UPDATE BEHAVIOR WITH NULL:
════════════════════════════════════════════════════════════
1. Field NOT SENT  → Database: UNCHANGED
2. Field SENT EMPTY → Database: SET TO NULL
3. Field SENT WITH VALUE → Database: SET TO VALUE
"""

from fastapi import APIRouter, HTTPException, Depends, Form
from pydantic import BaseModel
from typing import Optional
from core.database.connection import get_connection
from routes.auth import get_current_user

global_settings_router = APIRouter(prefix="/global_setting", tags=["Global Settings"])

VALID_TONES = {
    "Professional",
    "Professional but friendly",
    "Enthusiastic",
    "Concise",
    "Formal",
    "Casual",
}


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    """
    Convert empty or whitespace-only strings to None.

    - None → None (unchanged)
    - ""   → None (empty string becomes NULL)
    - "  " → None (whitespace-only becomes NULL)
    - "val" → "val" (leading/trailing whitespace trimmed)
    """
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class GlobalSettingsResponse(BaseModel):
    id: int
    user_id: int
    goal: Optional[str] = None
    value_prop: Optional[str] = None
    tone: Optional[str] = None
    cta: Optional[str] = None
    writing_guidelines: Optional[str] = None
    additional_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ==================================================================================
# PUT /global_setting - Update settings
# ==================================================================================
@global_settings_router.put("/", response_model=MessageResponse)
async def update_global_settings(
    goal: Optional[str] = Form(None),
    value_prop: Optional[str] = Form(None),
    tone: Optional[str] = Form(None),
    cta: Optional[str] = Form(None),
    writing_guidelines: Optional[str] = Form(None),
    additional_notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Update global settings for the current user.

    The frontend always sends ALL text fields on every save.
    FastAPI converts empty string "" → None for Optional[str] = Form(None),
    so cleared fields arrive as None and are stored as NULL.
    """
    user_id = current_user["user_id"]

    # ── Normalize all text fields ─────────────────────────────────────────────
    goal               = normalize_text_field(goal)
    value_prop         = normalize_text_field(value_prop)
    tone               = normalize_text_field(tone)
    cta                = normalize_text_field(cta)
    writing_guidelines = normalize_text_field(writing_guidelines)
    additional_notes   = normalize_text_field(additional_notes)

    # ── Validation ────────────────────────────────────────────────────────────
    if tone is not None and tone not in VALID_TONES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tone. Choose from: {', '.join(sorted(VALID_TONES))}"
        )

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM global_settings WHERE user_id = %s", (user_id,))
        existing = cursor.fetchone()

        try:
            if existing:
                text_field_map = [
                    ("goal",               goal),
                    ("value_prop",         value_prop),
                    ("tone",               tone),
                    ("cta",                cta),
                    ("writing_guidelines", writing_guidelines),
                    ("additional_notes",   additional_notes),
                ]
                update_fields = [f"{col} = %s" for col, _ in text_field_map]
                update_values = [val for _, val in text_field_map]
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                update_values.append(user_id)

                cursor.execute(
                    f"UPDATE global_settings SET {', '.join(update_fields)} WHERE user_id = %s",
                    update_values,
                )

            else:
                cursor.execute("""
                    INSERT INTO global_settings (
                        user_id, goal, value_prop, tone, cta,
                        writing_guidelines, additional_notes
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id, goal, value_prop, tone, cta,
                    writing_guidelines, additional_notes,
                ))

            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Global settings updated successfully")


# ==================================================================================
# GET /global_setting
# ==================================================================================
@global_settings_router.get("/", response_model=GlobalSettingsResponse)
def get_global_settings(current_user: dict = Depends(get_current_user)):
    """Get the current global settings for the user."""
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM global_settings WHERE user_id = %s", (user_id,))
        settings = cursor.fetchone()

    if not settings:
        raise HTTPException(status_code=404, detail="No global settings found")

    s = dict(settings)

    return GlobalSettingsResponse(
        id=s["id"],
        user_id=s["user_id"],
        goal=s["goal"],
        value_prop=s["value_prop"],
        tone=s["tone"],
        cta=s["cta"],
        writing_guidelines=s["writing_guidelines"],
        additional_notes=s["additional_notes"],
        created_at=s["created_at"],
        updated_at=s["updated_at"],
    )