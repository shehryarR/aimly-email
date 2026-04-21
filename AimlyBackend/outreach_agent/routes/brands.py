"""
Brands Management Routes
Handles CRUD for user brands (identity + SMTP credentials).

Each brand stores:
  - Display identity: name, business_name, business_info, logo (BLOB), signature
  - SMTP credentials: smtp_host, smtp_port, email_address, email_password (AES encrypted)
  - is_default flag: exactly one brand per user is the default

SECURITY:
  email_password is AES-256-GCM encrypted with SMTP_ENCRYPTION_KEY before storage.
  It is NEVER returned to the frontend in any response.
  It is decrypted only inside the email sending pipeline.

Logo is stored as LONGBLOB and returned as a base64 data URL on GET.
"""

from datetime import datetime
import base64
import smtplib
import ssl
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File, Query
from pydantic import BaseModel

from core.database.connection import get_connection
from routes.auth import get_current_user
from routes.utils.crypto import encrypt_smtp_password, decrypt_smtp_password

brands_router = APIRouter(prefix="/brands", tags=["Brands"])

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


# ══════════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════════

def get_mime_type_from_extension(extension: str) -> str:
    mime_map = {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".gif":  "image/gif",
        ".webp": "image/webp",
        ".svg":  "image/svg+xml",
    }
    return mime_map.get(extension.lower(), "application/octet-stream")


def normalize_text_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _logo_to_data_url(logo_bytes, mime_type: Optional[str]) -> Optional[str]:
    if logo_bytes and mime_type:
        try:
            b64 = base64.b64encode(logo_bytes).decode("utf-8")
            return f"data:{mime_type};base64,{b64}"
        except Exception:
            return None
    return None


async def _read_logo(logo: Optional[UploadFile]):
    """
    Parse an uploaded logo file.
    Returns (blob_bytes_or_None, mime_type_or_None, clear_flag).
      clear_flag=True means the field was sent as empty → set to NULL.
      clear_flag=False and blob=None means the field was not sent → leave unchanged.
    """
    if logo is None:
        return None, None, False  # not sent

    if logo.filename and logo.size and logo.size > 0:
        if logo.size > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Logo file size too large (max 5MB)")
        ext = f".{logo.filename.split('.')[-1].lower()}" if "." in logo.filename else ""
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid logo file type. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}",
            )
        blob = await logo.read()
        return blob, get_mime_type_from_extension(ext), False

    # Sent but empty → clear
    return None, None, True


# ══════════════════════════════════════════════════════════════════════════════════
# SMTP STATUS CHECK HELPER
# ══════════════════════════════════════════════════════════════════════════════════

class SmtpStatus(BaseModel):
    status_text: str
    status_code: int  # 0=not configured  1=working  2=auth error  3=connection error


def _check_smtp_status(host: Optional[str], port: Optional[int],
                       email: Optional[str], encrypted_password: Optional[str]) -> SmtpStatus:
    """
    Live SMTP connection test. Mirrors the status code convention used by
    _check_llm_status / _check_tavily_status in user_keys.py:
      0 = not configured
      1 = working
      2 = auth error  (credentials rejected — same as "limit" slot, semantically "creds bad")
      3 = connection error (host unreachable, timeout, TLS failure, etc.)
    """
    if not host or not port or not email or not encrypted_password:
        return SmtpStatus(status_text="Not configured", status_code=0)

    try:
        password = decrypt_smtp_password(encrypted_password)
    except ValueError:
        return SmtpStatus(status_text="Stored password is corrupted — re-save the brand", status_code=3)

    try:
        context = ssl.create_default_context()

        if port == 465:
            # SSL from the start
            with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                server.login(email, password)
        else:
            # STARTTLS (587 or 25)
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(email, password)

        return SmtpStatus(status_text="Working", status_code=1)

    except smtplib.SMTPAuthenticationError:
        return SmtpStatus(
            status_text="Authentication failed — check email address and app password",
            status_code=2,
        )
    except smtplib.SMTPConnectError:
        return SmtpStatus(
            status_text=f"Could not connect to {host}:{port}",
            status_code=3,
        )
    except smtplib.SMTPServerDisconnected:
        return SmtpStatus(
            status_text="Server disconnected unexpectedly",
            status_code=3,
        )
    except (TimeoutError, OSError) as e:
        return SmtpStatus(
            status_text=f"Connection timed out or refused — {str(e)[:60]}",
            status_code=3,
        )
    except ssl.SSLError as e:
        return SmtpStatus(
            status_text=f"TLS/SSL error — {str(e)[:60]}",
            status_code=3,
        )
    except Exception as e:
        return SmtpStatus(
            status_text=f"Unexpected error — {str(e)[:80]}",
            status_code=3,
        )


# ══════════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════════

class BrandResponse(BaseModel):
    id: int
    user_id: int
    business_name: Optional[str] = None
    business_info: Optional[str] = None
    logo_data: Optional[str] = None       # base64 data URL
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    email_address: Optional[str] = None
    # email_password is NEVER returned
    signature: Optional[str] = None
    is_default: int
    created_at: datetime
    updated_at: datetime


class BrandsListResponse(BaseModel):
    brands: List[BrandResponse]
    total: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    brand_id: Optional[int] = None


class SetDefaultRequest(BaseModel):
    brand_id: int


# ══════════════════════════════════════════════════════════════════════════════════
# GET /brands/ — list all brands for the current user
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.get("/", response_model=BrandsListResponse)
def get_brands(current_user: dict = Depends(get_current_user)):
    """Return all brands for the current user. Logo returned as base64 data URL."""
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, business_name, business_info,
                   logo, logo_mime_type, smtp_host, smtp_port, email_address,
                   signature, is_default, created_at, updated_at
            FROM brands WHERE user_id = %s ORDER BY is_default DESC, created_at ASC
        """, (user_id,))
        rows = cursor.fetchall()

    brands = []
    for row in rows:
        r = dict(row)
        brands.append(BrandResponse(
            id=r["id"],
            user_id=r["user_id"],
            business_name=r["business_name"],
            business_info=r["business_info"],
            logo_data=_logo_to_data_url(r.get("logo"), r.get("logo_mime_type")),
            smtp_host=r["smtp_host"],
            smtp_port=r["smtp_port"],
            email_address=r["email_address"],
            signature=r["signature"],
            is_default=r["is_default"] or 0,
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        ))

    return BrandsListResponse(brands=brands, total=len(brands))


# ══════════════════════════════════════════════════════════════════════════════════
# GET /brands/status/ — live SMTP connection test for one brand
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.get("/status/", response_model=SmtpStatus)
def get_brand_smtp_status(
    brand_id: int = Query(..., description="Brand ID to test"),
    current_user: dict = Depends(get_current_user),
):
    """
    Live SMTP connection test for a single brand.

    Decrypts the stored email_password, then attempts SMTP login.
    Never returns the decrypted password.

    Status codes:
      0 = not configured (missing host/port/email/password)
      1 = working
      2 = authentication error (wrong credentials)
      3 = connection / TLS error
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT smtp_host, smtp_port, email_address, email_password
            FROM brands
            WHERE id = %s AND user_id = %s
        """, (brand_id, user_id))
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Brand not found")

    r = dict(row)
    return _check_smtp_status(
        host=r.get("smtp_host"),
        port=r.get("smtp_port"),
        email=r.get("email_address"),
        encrypted_password=r.get("email_password"),
    )


# ══════════════════════════════════════════════════════════════════════════════════
# POST /brands/ — create one brand
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.post("/", response_model=MessageResponse)
async def create_brand(
    business_name: Optional[str] = Form(None),
    business_info: Optional[str] = Form(None),
    smtp_host: Optional[str] = Form(None),
    smtp_port: Optional[int] = Form(None),
    email_address: Optional[str] = Form(None),
    email_password: Optional[str] = Form(None),
    signature: Optional[str] = Form(None),
    is_default: Optional[int] = Form(0),
    logo: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Create a new brand. email_password is AES encrypted before storage."""
    user_id = current_user["user_id"]

    business_name = normalize_text_field(business_name)
    business_info = normalize_text_field(business_info)
    smtp_host     = normalize_text_field(smtp_host)
    email_address = normalize_text_field(email_address)
    signature     = normalize_text_field(signature)
    email_password_raw = normalize_text_field(email_password)

    if not business_name:
        raise HTTPException(status_code=400, detail="Business name is required")
    if not business_info:
        raise HTTPException(status_code=400, detail="Business info is required")
    if not email_address:
        raise HTTPException(status_code=400, detail="Email address is required")
    if not smtp_host:
        raise HTTPException(status_code=400, detail="SMTP host is required")
    if not smtp_port:
        raise HTTPException(status_code=400, detail="SMTP port is required")
    if not email_password_raw:
        raise HTTPException(status_code=400, detail="App password is required")

    logo_blob, logo_mime_type, _ = await _read_logo(logo)

    encrypted_password = encrypt_smtp_password(email_password_raw) if email_password_raw else None

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            if is_default:
                cursor.execute(
                    "UPDATE brands SET is_default = 0 WHERE user_id = %s", (user_id,)
                )

            cursor.execute("""
                INSERT INTO brands (
                    user_id, business_name, business_info,
                    logo, logo_mime_type, smtp_host, smtp_port,
                    email_address, email_password, signature, is_default
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id, business_name, business_info,
                logo_blob, logo_mime_type, smtp_host, smtp_port,
                email_address, encrypted_password, signature, 1 if is_default else 0,
            ))

            new_id = cursor.lastrowid
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Brand created successfully", brand_id=new_id)


# ══════════════════════════════════════════════════════════════════════════════════
# PUT /brands/ — update one brand by id (sent as form field)
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.put("/", response_model=MessageResponse)
async def update_brand(
    brand_id: int = Form(...),
    business_name: Optional[str] = Form(None),
    business_info: Optional[str] = Form(None),
    smtp_host: Optional[str] = Form(None),
    smtp_port: Optional[int] = Form(None),
    email_address: Optional[str] = Form(None),
    email_password: Optional[str] = Form(None),
    signature: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Update a brand. Only sent fields are updated.
    Send email_password as empty string to clear it.
    Send an empty logo file to clear the logo.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM brands WHERE id = %s AND user_id = %s", (brand_id, user_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Brand not found")

        update_fields = []
        update_values = []

        for col, raw_val in [
            ("business_name", business_name),
            ("business_info", business_info),
            ("smtp_host",     smtp_host),
            ("email_address", email_address),
            ("signature",     signature),
        ]:
            if raw_val is not None:
                update_fields.append(f"{col} = %s")
                update_values.append(normalize_text_field(raw_val))

        if smtp_port is not None:
            update_fields.append("smtp_port = %s")
            update_values.append(smtp_port)

        # email_password: None = not sent (skip), "" = clear, "value" = update
        if email_password is not None:
            normalized_pw = normalize_text_field(email_password)
            encrypted = encrypt_smtp_password(normalized_pw) if normalized_pw else None
            update_fields.append("email_password = %s")
            update_values.append(encrypted)

        # Logo
        logo_blob, logo_mime_type, logo_clear = await _read_logo(logo)
        if logo is not None:
            update_fields.append("logo = %s")
            update_values.append(logo_blob)  # None if clearing
            update_fields.append("logo_mime_type = %s")
            update_values.append(logo_mime_type)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        update_values.append(brand_id)

        try:
            cursor.execute(
                f"UPDATE brands SET {', '.join(update_fields)} WHERE id = %s",
                update_values,
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Brand updated successfully", brand_id=brand_id)


# ══════════════════════════════════════════════════════════════════════════════════
# DELETE /brands/ — delete brands by ids query param (ids=1,2,3)
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.delete("/", response_model=MessageResponse)
def delete_brands(
    ids: str = Query(..., description="Comma-separated brand IDs to delete"),
    current_user: dict = Depends(get_current_user),
):
    """
    Bulk delete brands. Cascades: campaign_preferences.brand_id is set to NULL
    via ON DELETE SET NULL on the FK.
    """
    user_id = current_user["user_id"]
    brand_ids = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]

    if not brand_ids:
        raise HTTPException(status_code=400, detail="No valid brand IDs provided")

    placeholders = ",".join(["%s"] * len(brand_ids))

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"DELETE FROM brands WHERE user_id = %s AND id IN ({placeholders})",
                [user_id] + brand_ids,
            )
            deleted = cursor.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message=f"Deleted {deleted} brand(s) successfully")


# ══════════════════════════════════════════════════════════════════════════════════
# PUT /brands/default/ — set one brand as the default for the user
# ══════════════════════════════════════════════════════════════════════════════════

@brands_router.put("/default/", response_model=MessageResponse)
def set_default_brand(
    body: SetDefaultRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Atomically set one brand as default.
    Unsets all other brands for this user first, then sets the target.
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM brands WHERE id = %s AND user_id = %s",
            (body.brand_id, user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Brand not found")

        try:
            cursor.execute("UPDATE brands SET is_default = 0 WHERE user_id = %s", (user_id,))
            cursor.execute(
                "UPDATE brands SET is_default = 1 WHERE id = %s AND user_id = %s",
                (body.brand_id, user_id),
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return MessageResponse(message="Default brand updated successfully", brand_id=body.brand_id)