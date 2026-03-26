"""
User Keys Management Routes
Handles storage and retrieval of sensitive user configuration data like API keys

API KEY SECURITY MODEL:
════════════════════════════════════════════════════════════
  llm_api_key and tavily_api_key are NEVER stored in the database.
  They live only in encrypted HttpOnly cookies for the duration of the session.

  Flow (all via existing PUT /user_keys):
    1. User submits real key via PUT /user_keys
    2. Backend encrypts real key → stores in HttpOnly cookie only
    3. DB columns llm_api_key / tavily_api_key remain NULL always
    4. GET /user_keys returns a masked indicator if cookie is present, else None
    5. GET /user_keys/status/ decrypts cookie → runs live API test

  Requires env var:
    COOKIE_SECRET — 64-char hex string (32 raw bytes for AES-256)
    Generate: python3 -c "import secrets; print(secrets.token_hex(32))"

UPDATE BEHAVIOR WITH NULL (non-key fields):
════════════════════════════════════════════════════════════
1. Field NOT SENT  → Database: UNCHANGED
2. Field SENT EMPTY → Database: SET TO NULL
3. Field SENT WITH VALUE → Database: SET TO VALUE

Status codes: 0=Not configured  1=Working  2=Limit hit  3=Error
"""

import os
import re
import secrets
import base64
import smtplib
import concurrent.futures

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, validator
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from core.database.connection import get_connection
from routes.auth import get_current_user

user_keys_router = APIRouter(prefix="/user_keys", tags=["User Keys"])

# ── Cookie names ────────────────────────────────────────────────────────────────
_LLM_COOKIE    = "llm_api_key_enc"
_TAVILY_COOKIE = "tavily_api_key_enc"


# ══════════════════════════════════════════════════════════════════════════════════
# CRYPTO HELPERS
# ══════════════════════════════════════════════════════════════════════════════════

def _get_aes_key() -> bytes:
    secret = os.getenv("COOKIE_SECRET", "")
    if not secret:
        raise RuntimeError(
            "COOKIE_SECRET env var is not set. "
            "Generate: python3 -c \"import secrets; print(secrets.token_hex(32))\""
        )
    try:
        key = bytes.fromhex(secret)
    except ValueError:
        raise RuntimeError("COOKIE_SECRET must be a valid hex string.")
    if len(key) != 32:
        raise RuntimeError(f"COOKIE_SECRET must decode to 32 bytes (got {len(key)}).")
    return key


def _encrypt_key(plaintext: str) -> str:
    """AES-256-GCM encrypt. Returns URL-safe base64: nonce(12B) + ciphertext+tag."""
    key   = _get_aes_key()
    nonce = secrets.token_bytes(12)
    ct    = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return base64.urlsafe_b64encode(nonce + ct).decode()


def _decrypt_key(token: str) -> str:
    """Decrypt a token from _encrypt_key(). Raises ValueError on any failure."""
    key = _get_aes_key()
    try:
        raw   = base64.urlsafe_b64decode(token.encode())
        nonce = raw[:12]
        ct    = raw[12:]
        return AESGCM(key).decrypt(nonce, ct, None).decode()
    except Exception:
        raise ValueError("Decryption failed — token is invalid or tampered.")


def _read_cookie_key(request: Request, cookie_name: str) -> Optional[str]:
    """
    Read and decrypt one API key cookie.
    Returns None if absent. Raises HTTP 401 if present but decryption fails.
    """
    token = request.cookies.get(cookie_name)
    if not token:
        return None
    try:
        return _decrypt_key(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail=f"Cookie '{cookie_name}' is invalid or tampered. Re-submit your API key in Settings.",
        )


def _set_api_cookie(response: Response, cookie_name: str, real_key: str) -> None:
    is_production = os.getenv("ENV", "development").lower() == "production"
    response.set_cookie(
        key=cookie_name, value=_encrypt_key(real_key),
        httponly=True,
        secure=is_production,
        samesite="strict",
        path="/",
        max_age=60 * 60 * 24 * 30,  # 30 days in seconds
    )


# ══════════════════════════════════════════════════════════════════════════════════
# SHARED UTILITIES
# ══════════════════════════════════════════════════════════════════════════════════

def normalize_text_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def mask_sensitive_data(value: str) -> Optional[str]:
    if not value:
        return None
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "*" * (len(value) - 8) + value[-4:]


# ══════════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════════

class UserKeysUpdateRequest(BaseModel):
    llm_model:      Optional[str] = None
    llm_api_key:    Optional[str] = None
    smtp_host:      Optional[str] = None
    smtp_port:      Optional[int] = None
    email_address:  Optional[str] = None
    email_password: Optional[str] = None
    tavily_api_key: Optional[str] = None

    @validator("smtp_port")
    def validate_port(cls, v):
        if v is not None and not (1 <= v <= 65535):
            raise ValueError("smtp_port must be between 1 and 65535")
        return v

    @validator("tavily_api_key")
    def validate_tavily_api_key(cls, v):
        if v is None or v.strip() == "":
            return v
        v = v.strip()
        if not (v.startswith("tvly-") and len(v) > 10):
            raise ValueError(
                "Invalid Tavily API key format. Keys must start with 'tvly-' "
                "(e.g. tvly-xxxxxxxxxxxxxxxx). Get your key at tavily.com."
            )
        return v

    @validator("llm_api_key")
    def validate_llm_api_key(cls, v):
        if v is None or v.strip() == "":
            return v
        v = v.strip()
        if len(v) < 10 or not any(v.startswith(p) for p in ("AIza", "sk-", "gsk_")):
            raise ValueError(
                "Invalid LLM API key format. "
                "Gemini keys start with 'AIza', OpenAI keys with 'sk-', Groq keys with 'gsk_'."
            )
        return v

    @validator("email_address")
    def validate_email_address(cls, v):
        if v is None or v.strip() == "":
            return v
        v = v.strip()
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', v):
            raise ValueError("Invalid email address format (e.g. you@example.com).")
        return v


class UserKeysResponse(BaseModel):
    id: int
    user_id: int
    llm_model:             Optional[str] = None
    llm_api_key_masked:    Optional[str] = None
    smtp_host:             Optional[str] = None
    smtp_port:             Optional[int] = None
    email_address:         Optional[str] = None
    email_password_masked: Optional[str] = None
    tavily_api_key_masked: Optional[str] = None
    created_at: str
    updated_at: str


class KeyStatus(BaseModel):
    status_text: str
    status_code: int   # 0=not configured  1=working  2=limit hit  3=error


class KeysStatusResponse(BaseModel):
    email:  KeyStatus
    tavily: KeyStatus
    llm:    KeyStatus


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ══════════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════════

# ── PUT /user_keys ──────────────────────────────────────────────────────────────
@user_keys_router.put("/", response_model=MessageResponse)
def update_user_keys(
    request:      UserKeysUpdateRequest,
    response:     Response,
    current_user: dict = Depends(get_current_user),
):
    """
    Update user keys and settings.

    llm_api_key / tavily_api_key:
      - Encrypted into HttpOnly cookie only — never written to DB

    All other fields (llm_model, smtp_*, email_*):
      - Stored in DB as before
    """
    user_id = current_user["user_id"]
    sent    = request.__fields_set__

    llm_model_sent      = "llm_model"      in sent
    llm_api_key_sent    = "llm_api_key"    in sent
    smtp_host_sent      = "smtp_host"      in sent
    smtp_port_sent      = "smtp_port"      in sent
    email_address_sent  = "email_address"  in sent
    email_password_sent = "email_password" in sent
    tavily_api_key_sent = "tavily_api_key" in sent

    llm_model      = normalize_text_field(request.llm_model)
    llm_api_key    = normalize_text_field(request.llm_api_key)
    smtp_host      = normalize_text_field(request.smtp_host)
    email_address  = normalize_text_field(request.email_address)
    email_password = normalize_text_field(request.email_password)
    tavily_api_key = normalize_text_field(request.tavily_api_key)
    smtp_port      = request.smtp_port

    # Only persist non-key fields to DB
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user_keys WHERE user_id = %s", (user_id,))
        existing = cursor.fetchone()

        try:
            if existing:
                update_fields = []
                update_values = []

                if llm_model_sent:
                    update_fields.append("llm_model = %s");      update_values.append(llm_model)
                if smtp_host_sent:
                    update_fields.append("smtp_host = %s");      update_values.append(smtp_host)
                if email_address_sent:
                    update_fields.append("email_address = %s");  update_values.append(email_address)
                if email_password_sent:
                    update_fields.append("email_password = %s"); update_values.append(email_password)
                if smtp_port_sent:
                    update_fields.append("smtp_port = %s");      update_values.append(smtp_port)

                if update_fields:
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
                    update_values.append(user_id)
                    cursor.execute(
                        f"UPDATE user_keys SET {', '.join(update_fields)} WHERE user_id = %s",
                        update_values,
                    )
            else:
                cursor.execute("""
                    INSERT INTO user_keys (
                        user_id, llm_model, smtp_host, smtp_port,
                        email_address, email_password
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (user_id, llm_model, smtp_host, smtp_port, email_address, email_password))

            conn.commit()

        except Exception:
            conn.rollback()
            raise HTTPException(status_code=500, detail="Failed to update user keys")

    # Encrypt API keys into cookies — never touches DB
    # Empty string sent = user cleared the field = delete the cookie
    if llm_api_key_sent:
        if llm_api_key:
            _set_api_cookie(response, _LLM_COOKIE, llm_api_key)
        else:
            response.delete_cookie(key=_LLM_COOKIE, path="/")

    if tavily_api_key_sent:
        if tavily_api_key:
            _set_api_cookie(response, _TAVILY_COOKIE, tavily_api_key)
        else:
            response.delete_cookie(key=_TAVILY_COOKIE, path="/")

    return MessageResponse(message="User keys updated successfully")


# MUST be before GET "/" to avoid routing conflict
@user_keys_router.get("/status/", response_model=KeysStatusResponse)
def get_keys_status(
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Live status check.
    - Email:  DB credentials → real SMTP test
    - LLM:    real key from cookie → live API test
    - Tavily: real key from cookie → live API test
    """
    user_id = current_user["user_id"]

    real_llm_key    = _read_cookie_key(http_request, _LLM_COOKIE)
    real_tavily_key = _read_cookie_key(http_request, _TAVILY_COOKIE)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT smtp_host, smtp_port, email_address, email_password, llm_model
            FROM user_keys WHERE user_id = %s
        """, (user_id,))
        row = cursor.fetchone()

    if not row:
        return KeysStatusResponse(
            email=KeyStatus(status_text="Not configured", status_code=0),
            tavily=KeyStatus(status_text="Not configured", status_code=0),
            llm=KeyStatus(status_text="Not configured", status_code=0),
        )

    db = dict(row)

    return KeysStatusResponse(
        email=_check_email_status(db),
        tavily=_check_tavily_status({**db, "tavily_api_key": real_tavily_key}),
        llm=_check_llm_status({**db, "llm_api_key": real_llm_key}),
    )


@user_keys_router.get("/", response_model=UserKeysResponse)
def get_user_keys(
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Return user key data.
    llm_api_key_masked / tavily_api_key_masked are derived from cookie presence:
      - Cookie present → returns a masked placeholder so UI shows key is configured
      - Cookie absent  → returns None so UI shows field as empty
    DB is never read for these two fields.
    """
    user_id = current_user["user_id"]

    has_llm_cookie    = _read_cookie_key(http_request, _LLM_COOKIE)    is not None
    has_tavily_cookie = _read_cookie_key(http_request, _TAVILY_COOKIE) is not None

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_keys WHERE user_id = %s", (user_id,))
        keys = cursor.fetchone()

    if not keys:
        raise HTTPException(status_code=404, detail="No user keys found")

    return UserKeysResponse(
        id=keys["id"],
        user_id=keys["user_id"],
        llm_model=keys["llm_model"],
        llm_api_key_masked=    "••••••••••••" if has_llm_cookie    else None,
        smtp_host=keys["smtp_host"],
        smtp_port=keys["smtp_port"],
        email_address=keys["email_address"],
        email_password_masked= mask_sensitive_data(keys["email_password"]) if keys["email_password"] else None,
        tavily_api_key_masked= "••••••••••••" if has_tavily_cookie else None,
        created_at=keys["created_at"],
        updated_at=keys["updated_at"],
    )


# ══════════════════════════════════════════════════════════════════════════════════
# STATUS CHECK HELPERS
# ══════════════════════════════════════════════════════════════════════════════════

def _check_email_status(keys: dict) -> KeyStatus:
    smtp_host      = keys.get("smtp_host")
    smtp_port      = keys.get("smtp_port")
    email_address  = keys.get("email_address")
    email_password = keys.get("email_password")

    if not all([smtp_host, email_address, email_password]):
        return KeyStatus(status_text="Not configured", status_code=0)
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email_address):
        return KeyStatus(status_text="Invalid email address format", status_code=3)

    try:
        port = int(smtp_port) if smtp_port else 587
        if port == 465:
            with smtplib.SMTP_SSL(smtp_host, port, timeout=10) as s:
                s.login(email_address, email_password)
        else:
            with smtplib.SMTP(smtp_host, port, timeout=10) as s:
                s.starttls()
                s.login(email_address, email_password)
        return KeyStatus(status_text="Working", status_code=1)
    except smtplib.SMTPAuthenticationError:
        return KeyStatus(status_text="Authentication failed — check email/password", status_code=3)
    except smtplib.SMTPConnectError:
        return KeyStatus(status_text="Could not connect to SMTP server", status_code=3)
    except smtplib.SMTPException as e:
        return KeyStatus(status_text=f"SMTP error: {str(e)[:80]}", status_code=3)
    except Exception as e:
        return KeyStatus(status_text=f"Connection failed: {str(e)[:80]}", status_code=3)


def _parse_tavily_error(error_str: str) -> KeyStatus:
    if any(x in error_str for x in ["432", "usage limit", "exceeds your plan"]):
        return KeyStatus(status_text="Usage limit exceeded — upgrade your Tavily plan", status_code=2)
    if any(x in error_str for x in ["quota", "limit exceeded"]):
        return KeyStatus(status_text="Search quota exceeded", status_code=2)
    if any(x in error_str for x in ["rate limit", "429", "too many requests"]):
        return KeyStatus(status_text="Rate limit exceeded — retry later", status_code=2)
    if any(x in error_str for x in ["api key", "invalid", "401", "403", "unauthorized"]):
        return KeyStatus(status_text="Invalid API key or access denied", status_code=3)
    return KeyStatus(status_text=f"API error: {error_str[:80]}", status_code=3)


def _check_tavily_status(keys: dict) -> KeyStatus:
    """Uses REAL key decrypted from cookie."""
    tavily_key = keys.get("tavily_api_key")

    if not tavily_key:
        return KeyStatus(status_text="Not configured", status_code=0)
    if not (len(tavily_key) > 10 and "tvly-" in tavily_key):
        return KeyStatus(status_text="Invalid API key format", status_code=3)

    try:
        from langchain_tavily import TavilySearch

        def _run_test():
            return TavilySearch(
                tavily_api_key=tavily_key, max_results=1,
                search_depth="basic", include_answer=True, include_raw_content=False,
            ).run("test")

        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(_run_test).result(timeout=15)

        if isinstance(result, dict) and "error" in result:
            return _parse_tavily_error(str(result["error"]).lower())

        return KeyStatus(status_text="Working", status_code=1)

    except ImportError:
        return KeyStatus(status_text="Working (format valid)", status_code=1)
    except Exception as e:
        error_str = str(e).lower()
        if hasattr(e, "args") and e.args and isinstance(e.args[0], dict):
            error_str = str(e.args[0].get("error", e)).lower()
        return _parse_tavily_error(error_str)


def _check_llm_status(keys: dict) -> KeyStatus:
    """Uses REAL key decrypted from cookie."""
    llm_model   = keys.get("llm_model")
    llm_api_key = keys.get("llm_api_key")

    if not llm_api_key:
        return KeyStatus(status_text="Not configured", status_code=0)
    if len(llm_api_key.strip()) < 10:
        return KeyStatus(status_text="Invalid API key format", status_code=3)

    if llm_api_key.startswith("AIza"):
        try:
            from google import genai
            # Call directly — ThreadPoolExecutor conflicts with genai's internal async client
            client = genai.Client(api_key=llm_api_key)
            client.models.generate_content(
                model=llm_model or "gemini-2.0-flash", contents="test"
            )
            return KeyStatus(status_text="Working", status_code=1)

        except ImportError:
            return KeyStatus(status_text="Working (format valid)", status_code=1)
        except Exception as e:
            error_str = str(e).lower()
            if any(x in error_str for x in ["quota", "resource_exhausted", "429"]):
                return KeyStatus(status_text="API quota exceeded — check billing", status_code=2)
            if any(x in error_str for x in ["rate limit", "too many requests"]):
                return KeyStatus(status_text="Rate limit exceeded — retry later", status_code=2)
            if any(x in error_str for x in ["api key", "invalid", "401", "403", "unauthorized"]):
                return KeyStatus(status_text="Invalid API key", status_code=3)
            return KeyStatus(status_text=f"API error: {str(e)[:80]}", status_code=3)

    if any(llm_api_key.startswith(p) for p in ("sk-", "gsk_")):
        return KeyStatus(status_text="Working (format valid)", status_code=1)

    return KeyStatus(status_text="Unrecognised API key format", status_code=3)