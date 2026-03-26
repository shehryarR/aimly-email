"""
Global Settings Management Routes
Handles user's global default settings that apply to all campaigns
UPDATED: Optional text fields now set to NULL when cleared (not empty string)

UPDATE BEHAVIOR WITH NULL:
════════════════════════════════════════════════════════════

1. Field NOT SENT during update:
   → Ignored (not in UPDATE clause)
   → Database: UNCHANGED

2. Field SENT but EMPTY:
   → Converted to NULL
   → Added to UPDATE with None
   → Database: SET TO NULL ✅

3. Field SENT WITH VALUE:
   → Added to UPDATE with value
   → Database: SET TO VALUE ✅
"""

from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import base64
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

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def get_mime_type_from_extension(extension: str) -> str:
    """Get MIME type from file extension"""
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    return mime_map.get(extension.lower(), 'application/octet-stream')


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    """
    Convert empty or whitespace-only strings to None.
    
    This ensures that when optional fields are cleared (sent as empty string),
    they're stored as NULL in the database instead of empty string.
    
    - None → None (unchanged)
    - "" → None (empty string becomes NULL)
    - "  " → None (whitespace-only becomes NULL)
    - "value" → "value" (with leading/trailing whitespace trimmed)
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
    logo_data: Optional[str] = None  # Base64 encoded logo data for frontend
    created_at: str
    updated_at: str


# ==================================================================================
# PUT /global_setting - Update settings including logo upload (BLOB)
# UPDATED: Optional text fields now set to NULL when cleared
# ==================================================================================
@global_settings_router.put("/", response_model=MessageResponse)
async def update_global_settings(
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
    logo: Optional[UploadFile] = File(None),  # Logo file upload (stored as BLOB)
    current_user: dict = Depends(get_current_user)
):
    """
    Update global settings for the current user.
    
    The frontend always sends ALL text fields on every save.
    FastAPI converts empty string "" → None for Optional[str] = Form(None),
    so cleared fields arrive as None and are stored as NULL.
    
    Text fields: always updated (None → NULL, value → value)
    Logo:
    - File with content → replace stored BLOB
    - Empty file (size 0) → clear logo (NULL)
    - Not sent → keep existing logo unchanged
    """
    user_id = current_user["user_id"]
    
    # ────────────────────────────────────────────────────────────────────────────
    # NORMALIZE ALL TEXT FIELDS
    # ────────────────────────────────────────────────────────────────────────────
    # FastAPI already converts empty string "" → None for Optional[str] = Form(None).
    # normalize_text_field handles any remaining whitespace-only strings.
    # Result: None → stored as NULL, "value" → stored as "value".
    
    bcc = normalize_text_field(bcc)
    business_name = normalize_text_field(business_name)
    business_info = normalize_text_field(business_info)
    goal = normalize_text_field(goal)
    value_prop = normalize_text_field(value_prop)
    tone = normalize_text_field(tone)
    cta = normalize_text_field(cta)
    extras = normalize_text_field(extras)
    email_instruction = normalize_text_field(email_instruction)
    signature = normalize_text_field(signature)
    
    # ────────────────────────────────────────────────────────────────────────────
    # VALIDATION
    # ────────────────────────────────────────────────────────────────────────────
    
    # Validate tone if provided
    if tone is not None and tone not in VALID_TONES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid tone. Choose from: {', '.join(sorted(VALID_TONES))}"
        )
    
    # ────────────────────────────────────────────────────────────────────────────
    # LOGO HANDLING
    # ────────────────────────────────────────────────────────────────────────────
    
    logo_blob = None
    logo_mime_type = None
    
    if logo is not None:
        if logo.filename and logo.size > 0:
            # New logo uploaded - validate and store
            if logo.size > MAX_IMAGE_SIZE:
                raise HTTPException(status_code=400, detail="Logo file size too large (max 5MB)")
            
            # Validate file extension
            file_extension = f".{logo.filename.split('.')[-1].lower()}" if '.' in logo.filename else ''
            if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid logo file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
                )
            
            # Read logo content
            logo_blob = await logo.read()
            logo_mime_type = get_mime_type_from_extension(file_extension)
        else:
            # Empty logo file - clear logo
            logo_blob = None
            logo_mime_type = None
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Check if global_settings entry exists
        cursor.execute("SELECT id FROM global_settings WHERE user_id = %s", (user_id,))
        existing = cursor.fetchone()
        
        try:
            if existing:
                # ────────────────────────────────────────────────────────────────
                # UPDATE existing record
                # ────────────────────────────────────────────────────────────────
                
                update_fields = []
                update_values = []
                
                # TEXT FIELDS — always update all of them.
                # Frontend sends every field on each save; None here means "clear to NULL".
                text_field_map = [
                    ("bcc", bcc),
                    ("business_name", business_name),
                    ("business_info", business_info),
                    ("goal", goal),
                    ("value_prop", value_prop),
                    ("tone", tone),
                    ("cta", cta),
                    ("extras", extras),
                    ("email_instruction", email_instruction),
                    ("signature", signature),
                ]
                for col, val in text_field_map:
                    update_fields.append(f"{col} = %s")
                    update_values.append(val)  # None → NULL, "value" → "value"
                
                # LOGO FIELD - Added only if sent
                if logo is not None:
                    update_fields.append("logo = %s")
                    update_values.append(logo_blob)  # None (→ NULL) or bytes
                    update_fields.append("logo_mime_type = %s")
                    update_values.append(logo_mime_type)  # None (→ NULL) or mime_type
                
                if update_fields:
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
                    update_values.append(user_id)
                    
                    query = f"UPDATE global_settings SET {', '.join(update_fields)} WHERE user_id = %s"
                    cursor.execute(query, update_values)
                
            else:
                # ────────────────────────────────────────────────────────────────
                # INSERT new record
                # ────────────────────────────────────────────────────────────────
                
                cursor.execute("""
                    INSERT INTO global_settings (
                        user_id, bcc, business_name, business_info, goal, value_prop,
                        tone, cta, extras, email_instruction, signature, logo, logo_mime_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id, bcc, business_name, business_info, goal, value_prop,
                    tone, cta, extras, email_instruction, signature, logo_blob, logo_mime_type
                ))
            
            conn.commit()
            
            message = "Global settings updated successfully"
            if logo is not None:
                if logo.filename and logo.size > 0:
                    message = "Global settings and logo uploaded successfully"
                else:
                    message = "Global settings and logo removed successfully"
                
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    return MessageResponse(message=message)


# ==================================================================================
# GET /global_setting - Get settings including logo data
# ==================================================================================
@global_settings_router.get("/", response_model=GlobalSettingsResponse)
def get_global_settings(current_user: dict = Depends(get_current_user)):
    """
    Get the current global settings for the user including logo data.
    Returns all stored global configuration settings with logo as base64 data URL.
    """
    user_id = current_user["user_id"]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM global_settings WHERE user_id = %s
        """, (user_id,))
        
        settings = cursor.fetchone()
    
    if not settings:
        raise HTTPException(status_code=404, detail="No global settings found")
    
    # Convert row to dict
    settings_dict = dict(settings)
    
    # Convert logo BLOB to base64 data URL for frontend
    logo_data = None
    if settings_dict.get("logo") and settings_dict.get("logo_mime_type"):
        try:
            logo_bytes = settings_dict["logo"]
            base64_data = base64.b64encode(logo_bytes).decode('utf-8')
            logo_data = f"data:{settings_dict['logo_mime_type']};base64,{base64_data}"
        except Exception as e:
            print(f"Error encoding logo: {e}")
    
    return GlobalSettingsResponse(
        id=settings_dict["id"],
        user_id=settings_dict["user_id"],
        bcc=settings_dict["bcc"],
        business_name=settings_dict["business_name"],
        business_info=settings_dict["business_info"],
        goal=settings_dict["goal"],
        value_prop=settings_dict["value_prop"],
        tone=settings_dict["tone"],
        cta=settings_dict["cta"],
        extras=settings_dict["extras"],
        email_instruction=settings_dict["email_instruction"],
        signature=settings_dict["signature"],
        logo_data=logo_data,  # Base64 data URL for frontend display
        created_at=settings_dict["created_at"],
        updated_at=settings_dict["updated_at"]
    )