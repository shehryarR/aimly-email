from datetime import datetime
"""
Company Management Routes
Handles CRUD operations for companies including bulk operations, CSV file uploads, and AI search

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

SORT / FILTER (GET /company/):
════════════════════════════════════════════════════════════
sort_by          = name | campaigns  (default: created_at DESC)
sort_order       = asc | desc        (default: asc)
filter_campaigns = comma-separated campaign IDs
filter_mode      = any | all         (default: any)
                   any → company must belong to AT LEAST ONE listed campaign (OR)
                   all → company must belong to ALL listed campaigns (AND)

COMPANY ADDITION FLAGS:
════════════════════════════════════════════════════════════
company_addition_active = 0   → idle
company_addition_active = -1  → JSON or CSV addition in progress
company_addition_active = N>0 → AI search job queued, N companies still to find
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form, Request
import os
import requests
from pydantic import BaseModel, validator
from typing import List, Optional, Set
import re
import json
import pymysql
from core.database.connection import get_connection
from routes.auth import get_current_user
from routes.user_keys import _read_cookie_key, _LLM_COOKIE, _TAVILY_COOKIE, _encrypt_key, _decrypt_key
from services.company_service import load_companies_data, improve_discovery_prompt

company_router = APIRouter(prefix="/company", tags=["Company Management"])


def _is_opted_out(sender_email: str, receiver_email: str) -> bool:
    """
    Check the microservice opt-out list.
    Returns True if the receiver has unsubscribed from this sender.
    Returns False if opted-in, microservice not configured, or on any error.
    """
    base_url = os.getenv("MICROSERVICE_BASE_URL")
    api_key  = os.getenv("MICROSERVICE_API_KEY")
    if not base_url or not api_key:
        return False
    try:
        resp = requests.get(
            f"{base_url}/optout/check",
            params={"sender_email": sender_email, "receiver_email": receiver_email},
            headers={"X-Api-Key": api_key},
            timeout=5,
        )
        if resp.status_code == 200:
            return not resp.json().get("should_send", True)
    except Exception as exc:
        print(f"[OptOut] Check failed — allowing send: {exc}")
    return False


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


# ── Pydantic Models ────────────────────────────────────────────────────────────

class CompanyCreateRequest(BaseModel):
    name: str
    email: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    company_info: Optional[str] = None

    @validator("email")
    def validate_email(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v

    @validator("name")
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Company name is required")
        return v


class CompanyUpdateRequest(BaseModel):
    """
    Update request for a single company.
    
    All fields are optional:
    - name: Required to update (cannot be cleared to NULL)
    - email: Required to update (cannot be cleared to NULL)
    - phone_number, address, company_info: Optional - can be cleared to NULL
    
    UPDATE BEHAVIOR:
    ════════════════════════════════════════════════════════════
    
    1. Field NOT in request (is None):
       → IGNORED (not in UPDATE)
       → Database unchanged
       
    2. Field in request as EMPTY (""):
       → Converted to None
       → Added to UPDATE with None
       → Database set to NULL
       
    3. Field in request with VALUE:
       → Added to UPDATE with value
       → Database set to value
    
    Example:
    ────────
    Request: {"id": 1, "phone_number": "", "address": "New Address", "company_info": None}
    
    - id: 1 → Not tracked (identifier)
    - phone_number: "" → Sent empty → Will be set to NULL
    - address: "New Address" → Sent with value → Will be set to "New Address"
    - company_info: None (not in JSON) → Not sent → Will be IGNORED
    
    Result in DB:
    - phone_number = NULL (was cleared)
    - address = "New Address" (was updated)
    - company_info = (unchanged - was not sent)
    """
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    company_info: Optional[str] = None

    @validator("email")
    def validate_email(cls, v):
        if v:
            v = v.strip().lower()
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
                raise ValueError("Invalid email address")
        return v


class AISearchRequest(BaseModel):
    query: str
    limit: int = 10
    include_phone: bool = False
    include_address: bool = False
    include_company_info: bool = False


class ImprovePromptRequest(BaseModel):
    prompt: str


class ImprovePromptResponse(BaseModel):
    original: str
    improved: str


class CompanyResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    company_info: Optional[str] = None
    created_at: datetime
    optedOut: bool = False
    campaign_ids: List[int] = []


class CompaniesListResponse(BaseModel):
    companies: List[CompanyResponse]
    total: int
    page: int
    size: int


class CreateCompaniesResponse(BaseModel):
    message: str
    success: bool = True
    created: int = 0
    company_ids: List[int] = []
    skipped: int = 0


class MessageResponse(BaseModel):
    message: str
    success: bool = True
    created: int = 0
    updated: int = 0
    company_ids: Optional[List[int]] = None


class AdditionStatusResponse(BaseModel):
    company_addition_active: int
    campaign_id: Optional[int] = None
    # 0  = idle
    # -1 = JSON/CSV addition in progress
    # N>0 = AI search job queued, N companies still to find
    # campaign_id: only set for AI search jobs, None otherwise


def get_existing_company_emails(cursor, user_id: int) -> Set[str]:
    cursor.execute("SELECT email FROM companies WHERE user_id = %s", (user_id,))
    return {row["email"].lower() for row in cursor.fetchall() if row["email"]}


def get_existing_company_names(cursor, user_id: int) -> Set[str]:
    cursor.execute("SELECT name FROM companies WHERE user_id = %s", (user_id,))
    return {row["name"].lower() for row in cursor.fetchall() if row["name"]}


# ==================================================================================
# POST /company/improve-prompt — Rewrite a rough prompt into an optimised discovery query
# ==================================================================================
@company_router.post("/improve-prompt", response_model=ImprovePromptResponse)
async def improve_prompt(
    body: ImprovePromptRequest,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Take a rough, user-written search intent and return an AI-improved version
    that is optimised for the company-discovery pipeline.

    The improved prompt is tuned to:
    - Use richer industry/niche terminology
    - Clarify geographic or demographic scope
    - Include business-type variety (firms, vendors, contractors, providers…)
    - Signal contact-discoverability (emails, directories, associations)

    No companies are created — this is a preview/suggestion endpoint only.
    """
    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    user_id = current_user["user_id"]

    llm_api_key = _read_cookie_key(http_request, _LLM_COOKIE)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = %s", (user_id,))
        user_keys = cursor.fetchone()

    if not llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key not configured. Add it in Settings.")
    if not user_keys or not user_keys["llm_model"]:
        raise HTTPException(status_code=400, detail="LLM model not configured. Configure it in Settings.")

    llm_config = {
        "api_key": llm_api_key,
        "model":   user_keys["llm_model"],
    }

    try:
        improved = await improve_discovery_prompt(
            raw_prompt=body.prompt.strip(),
            llm_config=llm_config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to improve prompt: {str(e)}")

    return ImprovePromptResponse(original=body.prompt.strip(), improved=improved)


# ==================================================================================
# GET /company/addition-status — Poll current AI search job progress
# ==================================================================================
@company_router.get("/addition-status", response_model=AdditionStatusResponse)
def get_addition_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the current company_addition_active value for the authenticated user.

    Frontend polls this to track progress of a queued AI search job.

    Returns:
        company_addition_active:
            0   = idle (no job running)
            -1  = JSON or CSV addition in progress
            N>0 = AI search job queued, N companies still to find
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT company_addition_active, company_addition_metadata FROM users WHERE id = %s",
            (user_id,)
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    active = row["company_addition_active"]

    # Parse campaign_id from metadata if this is an AI search job
    campaign_id = None
    if active > 0 and row["company_addition_metadata"]:
        try:
            metadata = json.loads(row["company_addition_metadata"])
            campaign_id = metadata.get("campaign_id")
        except (json.JSONDecodeError, TypeError):
            pass

    return AdditionStatusResponse(
        company_addition_active=active,
        campaign_id=campaign_id,
    )


# ==================================================================================
# POST /company/cancel-ai-search — Cancel a running AI company search job
# ==================================================================================
@company_router.post("/cancel-ai-search", response_model=AdditionStatusResponse)
def cancel_ai_search(
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a running AI company search job for the authenticated user.

    Sets company_addition_active = 0 and clears metadata.
    The worker's atomic insert checks this flag before each insertion,
    so no further companies will be added after cancellation.

    Returns the updated addition status (will be 0 if cancelled).
    """
    user_id = current_user["user_id"]

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT company_addition_active FROM users WHERE id = %s",
            (user_id,)
        )
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        if row["company_addition_active"] <= 0:
            raise HTTPException(status_code=409, detail="No active AI search job to cancel")

        cursor.execute("""
            UPDATE users
            SET company_addition_active = 0,
                company_addition_metadata = NULL
            WHERE id = %s
        """, (user_id,))
        conn.commit()

    print(f"🛑 User {user_id}: AI search job cancelled via API")
    return AdditionStatusResponse(company_addition_active=0, campaign_id=None)


# ==================================================================================
# POST /company - Create companies via JSON list, CSV file, or AI search
# ==================================================================================
@company_router.post("/", response_model=CreateCompaniesResponse)
async def create_companies(
    file:        Optional[UploadFile] = File(None),
    companies:   Optional[str]        = Form(None),
    ai_search:   Optional[str]        = Form(None),
    campaign_id: Optional[int]        = Form(None),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    created_count = 0
    skipped_count = 0
    created_ids = []

    companies_parsed: Optional[List[CompanyCreateRequest]] = None
    if companies:
        try:
            raw = json.loads(companies)
            if not isinstance(raw, list):
                raise ValueError("companies must be a JSON array")
            companies_parsed = [CompanyCreateRequest(**c) for c in raw]
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid companies JSON: {e}")

    ai_search_parsed: Optional[AISearchRequest] = None
    if ai_search:
        try:
            ai_search_parsed = AISearchRequest(**json.loads(ai_search))
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            raise HTTPException(status_code=422, detail=f"Invalid ai_search JSON: {e}")

    if not companies_parsed and not file and not ai_search_parsed:
        raise HTTPException(
            status_code=400,
            detail="No input provided. Send 'companies' (JSON form field), 'file' (CSV), or 'ai_search' (JSON form field)."
        )

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Validate campaign_id belongs to user ───────────────────────────────
        if campaign_id is not None:
            cursor.execute(
                "SELECT id FROM campaigns WHERE id = %s AND user_id = %s",
                (campaign_id, user_id)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Campaign not found")

        # ── Reject if a prior addition is still processing ───────────────────
        cursor.execute(
            "SELECT company_addition_active FROM users WHERE id = %s",
            (user_id,)
        )
        user_row = cursor.fetchone()
        if user_row and user_row["company_addition_active"] != 0:
            raise HTTPException(
                status_code=409,
                detail="A company addition is already in progress. Please wait for it to complete."
            )

        # ══════════════════════════════════════════════════════════════════════
        # MODE 1: JSON list
        # ══════════════════════════════════════════════════════════════════════
        if companies_parsed:
            # Mark as in-progress with -1
            cursor.execute(
                "UPDATE users SET company_addition_active = -1 WHERE id = %s",
                (user_id,)
            )
            conn.commit()

            try:
                for company in companies_parsed:
                    try:
                        cursor.execute("""
                            INSERT INTO companies (user_id, name, email, phone_number, address, company_info)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (user_id, company.name, company.email, company.phone_number, company.address, company.company_info))
                        created_count += 1
                        created_ids.append(cursor.lastrowid)
                    except pymysql.err.IntegrityError as e:
                        if "UNIQUE constraint failed" in str(e):
                            skipped_count += 1
                        else:
                            raise

                # Link to campaign if provided
                if campaign_id is not None and created_ids:
                    for cid in created_ids:
                        try:
                            cursor.execute("""
                                INSERT INTO campaign_company (campaign_id, company_id)
                                VALUES (%s, %s)
                            """, (campaign_id, cid))
                        except pymysql.err.IntegrityError:
                            pass

                conn.commit()

            except HTTPException:
                conn.rollback()
                raise
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to create companies: {str(e)}")
            finally:
                cursor.execute(
                    "UPDATE users SET company_addition_active = 0 WHERE id = %s",
                    (user_id,)
                )
                conn.commit()

        # ══════════════════════════════════════════════════════════════════════
        # MODE 2: CSV / Excel file
        # ══════════════════════════════════════════════════════════════════════
        elif file:
            if not file.filename or not file.filename.lower().endswith('.csv'):
                raise HTTPException(status_code=400, detail="File must be CSV format")

            df, error = load_companies_data(file.file, file.filename)

            if error:
                raise HTTPException(status_code=400, detail=f"CSV parsing error: {error}")

            if df is None or df.empty:
                raise HTTPException(status_code=400, detail="CSV file is empty")

            # Mark as in-progress with -1
            cursor.execute(
                "UPDATE users SET company_addition_active = -1 WHERE id = %s",
                (user_id,)
            )
            conn.commit()

            try:
                for index, row in df.iterrows():
                    name  = str(row.get('company_name', '')).strip()
                    email = str(row.get('email', '')).strip().lower() if row.get('email') else ''

                    if not name:
                        raise HTTPException(status_code=400, detail=f"Row {index + 2}: Company name is required")

                    if not email or '@' not in email:
                        raise HTTPException(status_code=400, detail=f"Row {index + 2}: Valid email is required")

                    try:
                        cursor.execute("""
                            INSERT INTO companies (user_id, name, email, phone_number, address, company_info)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (
                            user_id,
                            name,
                            email,
                            str(row.get('phone_number', '')).strip() or None,
                            str(row.get('address',      '')).strip() or None,
                            str(row.get('company_info', '')).strip() or None,
                        ))
                        created_count += 1
                        created_ids.append(cursor.lastrowid)
                    except pymysql.err.IntegrityError as e:
                        if "UNIQUE constraint failed" in str(e):
                            skipped_count += 1
                        else:
                            raise

                # Link to campaign if provided
                if campaign_id is not None and created_ids:
                    for cid in created_ids:
                        try:
                            cursor.execute("""
                                INSERT INTO campaign_company (campaign_id, company_id)
                                VALUES (%s, %s)
                            """, (campaign_id, cid))
                        except pymysql.err.IntegrityError:
                            pass

                conn.commit()

            except HTTPException:
                conn.rollback()
                raise
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to create companies: {str(e)}")
            finally:
                cursor.execute(
                    "UPDATE users SET company_addition_active = 0 WHERE id = %s",
                    (user_id,)
                )
                conn.commit()

        # ══════════════════════════════════════════════════════════════════════
        # MODE 3: AI Search — queue job, return immediately
        # ══════════════════════════════════════════════════════════════════════
        elif ai_search_parsed:
            # Validate API keys exist before queuing — read from cookies, not DB
            llm_api_key    = _read_cookie_key(http_request, _LLM_COOKIE)
            tavily_api_key = _read_cookie_key(http_request, _TAVILY_COOKIE)

            cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = %s", (user_id,))
            user_keys = cursor.fetchone()

            if not tavily_api_key:
                raise HTTPException(status_code=400, detail="Tavily API key not configured.")
            if not llm_api_key or not user_keys or not user_keys["llm_model"]:
                raise HTTPException(status_code=400, detail="LLM configuration not complete.")

            # Build metadata — encrypt API keys so worker can use them without cookies
            metadata = json.dumps({
                "query":       ai_search_parsed.query,
                "campaign_id": campaign_id,
                "include_phone":        ai_search_parsed.include_phone,
                "include_address":      ai_search_parsed.include_address,
                "include_company_info": ai_search_parsed.include_company_info,
                "llm_api_key_enc":    _encrypt_key(llm_api_key),
                "tavily_api_key_enc": _encrypt_key(tavily_api_key),
            })

            # Queue the job — worker picks it up
            cursor.execute("""
                UPDATE users
                SET company_addition_active = %s,
                    company_addition_metadata = %s
                WHERE id = %s
            """, (ai_search_parsed.limit, metadata, user_id))
            conn.commit()

            return CreateCompaniesResponse(
                message=f"AI search job queued. Looking for {ai_search_parsed.limit} companies.",
                success=True,
                created=0,
                company_ids=[],
                skipped=0,
            )

    if created_count > 0 and skipped_count > 0:
        message = f"Created {created_count} companies, skipped {skipped_count} duplicates"
    elif created_count > 0:
        message = f"Successfully created {created_count} companies"
    elif skipped_count > 0:
        message = f"No new companies created, skipped {skipped_count} duplicates"
    else:
        message = "No companies were created"

    return CreateCompaniesResponse(
        message=message,
        success=True,
        created=created_count,
        company_ids=created_ids,
        skipped=skipped_count,
    )


# ==================================================================================
# PUT /company - Update a list of companies
# UPDATED: Sets NULL when optional fields are cleared
# ==================================================================================
@company_router.put("/", response_model=MessageResponse)
def update_companies(
    companies: List[CompanyUpdateRequest],
    current_user: dict = Depends(get_current_user)
):
    """
    Update a list of companies.
    
    UPDATE BEHAVIOR WITH NULL:
    ════════════════════════════════════════════════════════════
    
    For REQUIRED fields (name, email):
    - Not sent → IGNORED (not in UPDATE)
    - Sent with value → UPDATED to value
    
    For OPTIONAL fields (phone_number, address, company_info):
    - Not sent → IGNORED (not in UPDATE)
    - Sent empty ("") → CLEARED TO NULL in database
    - Sent with value → UPDATED to value
    
    Example Request:
    ────────────────
    [
      {
        "id": 1,
        "name": "New Name",           ← Sent with value → update
        "email": "new@example.com",   ← Sent with value → update
        "phone_number": "",           ← Sent empty → set to NULL
        "address": "New Address",     ← Sent with value → update
        "company_info": null          ← Not sent in JSON → ignore
      }
    ]
    
    Database Result:
    - name: "New Name" (updated)
    - email: "new@example.com" (updated)
    - phone_number: NULL (cleared)
    - address: "New Address" (updated)
    - company_info: (unchanged - not sent)
    """
    user_id = current_user["user_id"]
    updated_count = 0

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            for company in companies:
                cursor.execute("""
                    SELECT id FROM companies WHERE id = %s AND user_id = %s
                """, (company.id, user_id))

                if not cursor.fetchone():
                    continue

                # ────────────────────────────────────────────────────────────────
                # STEP 1: TRACK which OPTIONAL fields were sent
                # ────────────────────────────────────────────────────────────────
                
                phone_number_sent = company.phone_number is not None
                address_sent      = company.address      is not None
                company_info_sent = company.company_info is not None
                
                # ────────────────────────────────────────────────────────────────
                # STEP 2: NORMALIZE optional text fields
                # ────────────────────────────────────────────────────────────────
                
                phone_number = normalize_text_field(company.phone_number)
                address      = normalize_text_field(company.address)
                company_info = normalize_text_field(company.company_info)
                
                # name and email are handled separately (no normalization for required fields)
                name  = company.name.strip() if company.name  is not None else None
                email = company.email        if company.email is not None else None
                
                # ────────────────────────────────────────────────────────────────
                # STEP 3: BUILD UPDATE clause
                # ────────────────────────────────────────────────────────────────
                
                update_fields = []
                update_values = []

                # Required fields - add if sent
                if name is not None:
                    update_fields.append("name = %s")
                    update_values.append(name)

                if email is not None:
                    update_fields.append("email = %s")
                    update_values.append(email)

                # Optional fields - use SENT tracking + normalized values
                if phone_number_sent:
                    update_fields.append("phone_number = %s")
                    update_values.append(phone_number)  # None (→ NULL) or "value"

                if address_sent:
                    update_fields.append("address = %s")
                    update_values.append(address)  # None (→ NULL) or "value"

                if company_info_sent:
                    update_fields.append("company_info = %s")
                    update_values.append(company_info)  # None (→ NULL) or "value"

                # Execute update only if there are fields to update
                if update_fields:
                    update_values.append(company.id)
                    update_values.append(user_id)
                    query = f"""
                        UPDATE companies
                        SET {', '.join(update_fields)}
                        WHERE id = %s AND user_id = %s
                    """
                    try:
                        cursor.execute(query, update_values)
                        if cursor.rowcount > 0:
                            updated_count += 1
                    except pymysql.err.IntegrityError as e:
                        if "UNIQUE constraint failed" in str(e):
                            raise HTTPException(
                                status_code=409,
                                detail=f"Email {email} already exists for another company"
                            )
                        else:
                            raise

            conn.commit()

        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully updated {updated_count} companies",
        success=True,
        updated=updated_count,
    )


# ==================================================================================
# GET /company - Get companies with pagination, search, server-side sort + filter
#
# NEW params (added to existing endpoint):
#   sort_by          = name | campaigns   (default: created_at DESC)
#   sort_order       = asc | desc         (default: asc)
#   filter_campaigns = "1,2,3"            AND logic: company must belong to ALL IDs
#
# Existing params unchanged:
#   ids, page, size, search
# ==================================================================================
@company_router.get("/", response_model=CompaniesListResponse)
def get_companies(
    ids:              Optional[str] = Query(None,  description="Comma-separated company IDs"),
    page:             int           = Query(1,  ge=1),
    size:             int           = Query(10, ge=1),
    search:           Optional[str] = Query(None,  description="Search by name or email (case-insensitive)"),
    sort_by:          Optional[str] = Query(None,  description="Sort field: name | campaigns"),
    sort_order:       Optional[str] = Query("asc", description="Sort direction: asc | desc"),
    filter_campaigns:  Optional[str] = Query(None,   description="Comma-separated campaign IDs"),
    filter_mode:       Optional[str] = Query("any",  description="Filter mode: any (OR) | all (AND)"),
    filter_categories: Optional[str] = Query(None,   description="Comma-separated category IDs"),
    category_filter_mode: Optional[str] = Query("any", description="Filter mode for categories: any (OR) | all (AND)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get companies with optional full-text search, server-side sorting, and campaign filtering.

    - ids=1,2,3            → fetch specific companies (bypasses all other params)
    - search=acme          → filters by name OR email, total reflects filtered count
    - sort_by=name         → alphabetical by LOWER(name) ASC/DESC across all pages
    - sort_by=campaigns    → by number of campaigns the company belongs to, cross-page
    - filter_campaigns=1,2 → companies enrolled in listed campaigns
    - filter_mode=any      → at least one match (OR logic, default)
    - filter_mode=all      → must match all (AND logic)
    - page + size          → pagination applied AFTER sort + filter
    """
    user_id = current_user["user_id"]
    use_all_mode = filter_mode and filter_mode.strip().lower() == "all"

    with get_connection() as conn:
        cursor = conn.cursor()

        # ── Fetch by specific IDs — bypasses all sort/filter/search ────────────
        if ids:
            company_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]
            if not company_ids:
                return CompaniesListResponse(companies=[], total=0, page=page, size=size)

            placeholders = ','.join(['%s'] * len(company_ids))
            cursor.execute(f"""
                SELECT * FROM companies
                WHERE user_id = %s AND id IN ({placeholders})
                ORDER BY created_at DESC
            """, [user_id] + company_ids)

            companies = cursor.fetchall()
            return CompaniesListResponse(
                companies=[CompanyResponse(**dict(c)) for c in companies],
                total=len(companies),
                page=page,
                size=size,
            )

        # ── Validate / normalise sort params ───────────────────────────────────
        valid_sort = {"name", "campaigns"}
        if sort_by not in valid_sort:
            sort_by = None
        sort_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"

        # ── Parse campaign filter IDs ──────────────────────────────────────────
        campaign_filter_ids: list[int] = []
        if filter_campaigns and filter_campaigns.strip():
            try:
                campaign_filter_ids = [
                    int(x.strip()) for x in filter_campaigns.split(",") if x.strip()
                ]
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="filter_campaigns must be comma-separated integers"
                )

        # ── Parse category filter IDs ──────────────────────────────────────────
        category_filter_ids: list[int] = []
        if filter_categories and filter_categories.strip():
            try:
                category_filter_ids = [
                    int(x.strip()) for x in filter_categories.split(",") if x.strip()
                ]
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="filter_categories must be comma-separated integers"
                )
        use_cat_all_mode = category_filter_mode and category_filter_mode.strip().lower() == "all"

        # ── Build WHERE clause (user + optional text search) ───────────────────
        where_parts  = ["c.user_id = %s"]
        base_params: list = [user_id]

        if search and search.strip():
            where_parts.append("(c.name LIKE %s OR c.email LIKE %s)")
            pattern = f"%{search.strip()}%"
            base_params += [pattern, pattern]

        where_str = "WHERE " + " AND ".join(where_parts)

        # ── Campaign filter JOIN + HAVING (ANY = OR logic, ALL = AND logic) ───
        if campaign_filter_ids:
            placeholders       = ",".join(["%s"] * len(campaign_filter_ids))
            filter_join        = f"""
                LEFT JOIN campaign_company cc_f
                    ON cc_f.company_id = c.id
                    AND cc_f.campaign_id IN ({placeholders})
            """
            filter_join_params = list(campaign_filter_ids)
            if use_all_mode:
                having_clause  = f"HAVING COUNT(DISTINCT cc_f.campaign_id) = {len(campaign_filter_ids)}"
            else:
                having_clause  = "HAVING COUNT(DISTINCT cc_f.campaign_id) >= 1"
        else:
            filter_join        = ""
            filter_join_params = []
            having_clause      = ""

        # ── Category filter JOIN + HAVING ──────────────────────────────────────
        if category_filter_ids:
            cat_placeholders    = ",".join(["%s"] * len(category_filter_ids))
            cat_filter_join     = f"""
                LEFT JOIN category_company cat_f
                    ON cat_f.company_id = c.id
                    AND cat_f.category_id IN ({cat_placeholders})
            """
            cat_filter_params   = list(category_filter_ids)
            if use_cat_all_mode:
                cat_having = f"AND COUNT(DISTINCT cat_f.category_id) = {len(category_filter_ids)}"
            else:
                cat_having = "AND COUNT(DISTINCT cat_f.category_id) >= 1"
        else:
            cat_filter_join   = ""
            cat_filter_params = []
            cat_having        = ""

        # Merge HAVING clauses
        if having_clause and cat_having:
            merged_having = having_clause + " " + cat_having
        elif cat_having:
            merged_having = "HAVING " + cat_having.lstrip("AND ").strip()
        else:
            merged_having = having_clause

        # ── ORDER BY clause ────────────────────────────────────────────────────
        if sort_by == "name":
            order_clause = f"ORDER BY LOWER(c.name) {sort_dir}"
        elif sort_by == "campaigns":
            order_clause = f"ORDER BY campaign_count {sort_dir}, LOWER(c.name) ASC"
        else:
            order_clause = "ORDER BY c.created_at DESC"

        # ── COUNT query — applied after filter, drives pagination total ────────
        count_params = filter_join_params + cat_filter_params + base_params
        count_query  = f"""
            SELECT COUNT(*) AS total FROM (
                SELECT c.id
                FROM companies c
                {filter_join}
                {cat_filter_join}
                {where_str}
                GROUP BY c.id
                {merged_having}
            ) AS subq
        """
        cursor.execute(count_query, count_params)
        total = cursor.fetchone()["total"]

        # ── DATA query — sort then paginate ────────────────────────────────────
        offset      = (page - 1) * size
        data_params = filter_join_params + cat_filter_params + base_params + [size, offset]
        data_query  = f"""
            SELECT
                c.id, c.user_id, c.name, c.email,
                c.phone_number, c.address, c.company_info, c.created_at,
                COUNT(DISTINCT cc_all.campaign_id) AS campaign_count
            FROM companies c
            {filter_join}
            {cat_filter_join}
            LEFT JOIN campaign_company cc_all ON cc_all.company_id = c.id
            {where_str}
            GROUP BY c.id
            {merged_having}
            {order_clause}
            LIMIT %s OFFSET %s
        """
        cursor.execute(data_query, data_params)
        rows = cursor.fetchall()

        # ── Fetch sender email from SMTP credentials for opt-out checks ─────
        cursor.execute("SELECT email_address FROM user_keys WHERE user_id = %s", (user_id,))
        smtp_row = cursor.fetchone()
        sender_email = smtp_row["email_address"] if smtp_row and smtp_row["email_address"] else None

        # ── Fetch campaign_ids for each company in one query ───────────────
        company_ids_on_page = [r["id"] for r in rows]
        campaign_ids_map: dict[int, list[int]] = {r["id"]: [] for r in rows}
        if company_ids_on_page:
            placeholders_ids = ",".join(["%s"] * len(company_ids_on_page))
            cursor.execute(f"""
                SELECT company_id, campaign_id
                FROM campaign_company
                WHERE company_id IN ({placeholders_ids})
            """, company_ids_on_page)
            for cc_row in cursor.fetchall():
                campaign_ids_map[cc_row["company_id"]].append(cc_row["campaign_id"])

        company_list = [
            CompanyResponse(
                id=r["id"],
                user_id=r["user_id"],
                name=r["name"],
                email=r["email"],
                phone_number=r["phone_number"],
                address=r["address"],
                company_info=r["company_info"],
                created_at=r["created_at"],
                optedOut=_is_opted_out(sender_email, r["email"]) if sender_email else False,
                campaign_ids=campaign_ids_map.get(r["id"], []),
            )
            for r in rows
        ]

    return CompaniesListResponse(companies=company_list, total=total, page=page, size=size)


# ==================================================================================
# DELETE /company - Delete companies by IDs
# ==================================================================================
@company_router.delete("/", response_model=MessageResponse)
def delete_companies(
    ids: str = Query(..., description="Comma-separated company IDs"),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    company_ids = [int(id_.strip()) for id_ in ids.split(',') if id_.strip().isdigit()]

    if not company_ids:
        raise HTTPException(status_code=400, detail="No valid company IDs provided")

    with get_connection() as conn:
        cursor = conn.cursor()

        try:
            placeholders = ','.join(['%s'] * len(company_ids))
            cursor.execute(f"""
                DELETE FROM companies
                WHERE user_id = %s AND id IN ({placeholders})
            """, [user_id] + company_ids)

            deleted_count = cursor.rowcount
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete companies: {str(e)}")

    return MessageResponse(
        message=f"Successfully deleted {deleted_count} companies",
        success=True,
    )