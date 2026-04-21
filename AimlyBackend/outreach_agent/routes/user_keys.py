"""
User Keys Management Routes
Handles storage and retrieval of sensitive user configuration — API keys and model selection.

SECURITY MODEL:
════════════════════════════════════════════════════════════
  llm_api_key, tavily_api_key, and llm_model are NEVER stored in the database.
  They live only in encrypted HttpOnly cookies.

  Flow (PUT /user_keys):
    1. User submits key/model via PUT /user_keys
    2. Backend encrypts value → stores in HttpOnly cookie only
    3. GET /user_keys returns masked indicator if cookie present, else None
    4. GET /user_keys/status/ decrypts cookies → runs live API tests

  Cookie names:
    llm_api_key_enc   — encrypted LLM API key
    tavily_api_key_enc — encrypted Tavily API key
    llm_model_enc     — encrypted model name (e.g. gemini-2.5-flash)

  Requires env var:
    COOKIE_SECRET — 64-char hex string (32 raw bytes for AES-256)
    Generate: python3 -c "import secrets; print(secrets.token_hex(32))"

Status codes: 0=Not configured  1=Working  2=Limit hit  3=Error
"""

import os
import re
import concurrent.futures
import smtplib

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, validator
from typing import Optional

from routes.auth import get_current_user
from routes.utils.crypto import (
    _read_cookie_key,
    _set_api_cookie,
    _encrypt_key,
    _decrypt_key,
    _LLM_COOKIE,
    _TAVILY_COOKIE,
)

user_keys_router = APIRouter(prefix="/user_keys", tags=["User Keys"])

_LLM_MODEL_COOKIE = "llm_model_enc"
_DEFAULT_MODEL    = "gemini-2.5-flash"


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _read_llm_model(request: Request) -> str:
    """Read llm_model from cookie. Returns default if absent or unreadable."""
    token = request.cookies.get(_LLM_MODEL_COOKIE)
    if not token:
        return _DEFAULT_MODEL
    try:
        return _decrypt_key(token) or _DEFAULT_MODEL
    except ValueError:
        return _DEFAULT_MODEL


def _set_model_cookie(response: Response, model: str) -> None:
    is_production = os.getenv("ENV", "development").lower() == "production"
    response.set_cookie(
        key=_LLM_MODEL_COOKIE,
        value=_encrypt_key(model),
        httponly=True,
        secure=is_production,
        samesite="strict",
        path="/",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_text_field(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class UserKeysUpdateRequest(BaseModel):
    llm_model:      Optional[str] = None
    llm_api_key:    Optional[str] = None
    tavily_api_key: Optional[str] = None

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


class UserKeysResponse(BaseModel):
    llm_model:             Optional[str] = None
    llm_api_key_masked:    Optional[str] = None
    tavily_api_key_masked: Optional[str] = None


class KeyStatus(BaseModel):
    status_text: str
    status_code: int   # 0=not configured  1=working  2=limit hit  3=error


class KeysStatusResponse(BaseModel):
    tavily: KeyStatus
    llm:    KeyStatus


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@user_keys_router.put("/", response_model=MessageResponse)
def update_user_keys(
    request:      UserKeysUpdateRequest,
    response:     Response,
    current_user: dict = Depends(get_current_user),
):
    """
    Save llm_model, llm_api_key, and tavily_api_key — all as encrypted cookies.
    Nothing is written to the database.

    Empty string sent = user cleared the field = delete the cookie.
    Field not sent = leave cookie unchanged.
    """
    sent = request.__fields_set__

    if "llm_model" in sent:
        model = normalize_text_field(request.llm_model) or _DEFAULT_MODEL
        _set_model_cookie(response, model)

    if "llm_api_key" in sent:
        llm_api_key = normalize_text_field(request.llm_api_key)
        if llm_api_key:
            _set_api_cookie(response, _LLM_COOKIE, llm_api_key)
        else:
            response.delete_cookie(key=_LLM_COOKIE, path="/")

    if "tavily_api_key" in sent:
        tavily_api_key = normalize_text_field(request.tavily_api_key)
        if tavily_api_key:
            _set_api_cookie(response, _TAVILY_COOKIE, tavily_api_key)
        else:
            response.delete_cookie(key=_TAVILY_COOKIE, path="/")

    return MessageResponse(message="User keys updated successfully")


@user_keys_router.get("/status/", response_model=KeysStatusResponse)
def get_keys_status(
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Live status check for LLM and Tavily keys.
    All values read from cookies — no DB access.
    """
    real_llm_key    = _read_cookie_key(http_request, _LLM_COOKIE)
    real_tavily_key = _read_cookie_key(http_request, _TAVILY_COOKIE)
    llm_model       = _read_llm_model(http_request)

    return KeysStatusResponse(
        tavily=_check_tavily_status(real_tavily_key),
        llm=_check_llm_status(real_llm_key, llm_model),
    )


@user_keys_router.get("/", response_model=UserKeysResponse)
def get_user_keys(
    http_request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Return current key configuration.
    API keys are never returned in full — only masked presence indicators.
    llm_model is returned plaintext from cookie (not sensitive).
    """
    has_llm_cookie    = _read_cookie_key(http_request, _LLM_COOKIE)    is not None
    has_tavily_cookie = _read_cookie_key(http_request, _TAVILY_COOKIE) is not None
    llm_model         = _read_llm_model(http_request)

    return UserKeysResponse(
        llm_model=llm_model,
        llm_api_key_masked=    "••••••••••••" if has_llm_cookie    else None,
        tavily_api_key_masked= "••••••••••••" if has_tavily_cookie else None,
    )


# ══════════════════════════════════════════════════════════════════════════════
# STATUS CHECK HELPERS
# ══════════════════════════════════════════════════════════════════════════════

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


def _check_tavily_status(tavily_key: Optional[str]) -> KeyStatus:
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


def _check_llm_status(llm_api_key: Optional[str], llm_model: str) -> KeyStatus:
    if not llm_api_key:
        return KeyStatus(status_text="Not configured", status_code=0)
    if len(llm_api_key.strip()) < 10:
        return KeyStatus(status_text="Invalid API key format", status_code=3)

    if llm_api_key.startswith("AIza"):
        try:
            from google import genai
            client = genai.Client(api_key=llm_api_key)
            try:
                client.models.generate_content(
                    model=llm_model or _DEFAULT_MODEL, contents="test"
                )
                return KeyStatus(status_text="Working", status_code=1)
            finally:
                client.close()

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