"""
Crypto Utilities
AES-256-GCM helpers for encrypting/decrypting API key cookies and SMTP passwords.

Cookie encryption uses COOKIE_SECRET env var (64-char hex / 32 raw bytes).
SMTP password encryption uses SMTP_ENCRYPTION_KEY env var (same format).

Generate either:
    python3 -c "import secrets; print(secrets.token_hex(32))"
"""

import os
import secrets
import base64
from typing import Optional

from fastapi import HTTPException, Request, Response
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ── Cookie names ─────────────────────────────────────────────────────────────────
_LLM_COOKIE    = "llm_api_key_enc"
_TAVILY_COOKIE = "tavily_api_key_enc"


# ══════════════════════════════════════════════════════════════════════════════════
# INTERNAL KEY LOADERS
# ══════════════════════════════════════════════════════════════════════════════════

def _load_hex_key(env_var: str) -> bytes:
    """Load and validate a 32-byte AES key from a hex env var."""
    secret = os.getenv(env_var, "")
    if not secret:
        raise RuntimeError(
            f"{env_var} env var is not set. "
            "Generate: python3 -c \"import secrets; print(secrets.token_hex(32))\""
        )
    try:
        key = bytes.fromhex(secret)
    except ValueError:
        raise RuntimeError(f"{env_var} must be a valid hex string.")
    if len(key) != 32:
        raise RuntimeError(f"{env_var} must decode to 32 bytes (got {len(key)}).")
    return key


def _get_aes_key() -> bytes:
    """AES key for cookie encryption (COOKIE_SECRET)."""
    return _load_hex_key("COOKIE_SECRET")


def _get_smtp_key() -> bytes:
    """AES key for SMTP password encryption (SMTP_ENCRYPTION_KEY)."""
    return _load_hex_key("SMTP_ENCRYPTION_KEY")


# ══════════════════════════════════════════════════════════════════════════════════
# GENERIC AES-256-GCM ENCRYPT / DECRYPT
# ══════════════════════════════════════════════════════════════════════════════════

def _aes_encrypt(plaintext: str, key: bytes) -> str:
    """AES-256-GCM encrypt. Returns URL-safe base64: nonce(12B) + ciphertext+tag."""
    nonce = secrets.token_bytes(12)
    ct    = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return base64.urlsafe_b64encode(nonce + ct).decode()


def _aes_decrypt(token: str, key: bytes) -> str:
    """Decrypt a token from _aes_encrypt(). Raises ValueError on any failure."""
    try:
        raw   = base64.urlsafe_b64decode(token.encode())
        nonce = raw[:12]
        ct    = raw[12:]
        return AESGCM(key).decrypt(nonce, ct, None).decode()
    except Exception:
        raise ValueError("Decryption failed — token is invalid or tampered.")


# ══════════════════════════════════════════════════════════════════════════════════
# COOKIE HELPERS (LLM / Tavily keys — use COOKIE_SECRET)
# ══════════════════════════════════════════════════════════════════════════════════

def _encrypt_key(plaintext: str) -> str:
    """Encrypt an API key for cookie storage."""
    return _aes_encrypt(plaintext, _get_aes_key())


def _decrypt_key(token: str) -> str:
    """Decrypt an API key cookie token. Raises ValueError on failure."""
    return _aes_decrypt(token, _get_aes_key())


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
        key=cookie_name,
        value=_encrypt_key(real_key),
        httponly=True,
        secure=is_production,
        samesite="strict",
        path="/",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )


# ══════════════════════════════════════════════════════════════════════════════════
# SMTP PASSWORD HELPERS (use SMTP_ENCRYPTION_KEY)
# ══════════════════════════════════════════════════════════════════════════════════

def encrypt_smtp_password(plaintext: str) -> str:
    """Encrypt an SMTP password for storage in the brands table."""
    return _aes_encrypt(plaintext, _get_smtp_key())


def decrypt_smtp_password(token: str) -> str:
    """
    Decrypt an SMTP password from the brands table.
    Raises ValueError on failure — callers should catch and raise HTTP 500.
    """
    return _aes_decrypt(token, _get_smtp_key())