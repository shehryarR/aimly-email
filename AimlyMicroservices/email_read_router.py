import hmac
import hashlib
import os
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Annotated
from datetime import datetime
from database import get_db_connection

router = APIRouter(prefix="/read-receipt", tags=["Read Receipt"])

MICROSERVICE_API_KEY = os.getenv("MICROSERVICE_API_KEY", "your-super-secure-microservice-key")


# ── Models ────────────────────────────────────────────────────────────────────

class AddEmailRequest(BaseModel):
    email_id: int

class MarkProcessedRequest(BaseModel):
    read_ids: List[int]


# ── Auth & signing helpers ────────────────────────────────────────────────────

def verify_api_key(x_api_key: Annotated[str, Header()]):
    if x_api_key != MICROSERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _compute_sig(email_id: int) -> str:
    """HMAC-SHA256 over email_id, keyed by MICROSERVICE_API_KEY."""
    msg = f"{email_id}".encode()
    return hmac.new(MICROSERVICE_API_KEY.encode(), msg, hashlib.sha256).hexdigest()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def add_email(
    request: AddEmailRequest,
    x_api_key: Annotated[str, Header()] = None,
):
    verify_api_key(x_api_key)

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM email_reads WHERE email_id = %s",
                (request.email_id,),
            )
            if cursor.fetchone():
                return {
                    "status":   "already_exists",
                    "email_id": request.email_id,
                    "message":  "Email already registered",
                }

            cursor.execute(
                "INSERT INTO email_reads (email_id, read_at, processed, created_at) VALUES (%s, NULL, 0, %s)",
                (request.email_id, datetime.utcnow()),
            )
        conn.commit()

    return {
        "status":   "success",
        "email_id": request.email_id,
        "message":  "Email registered successfully",
    }


@router.get("/mark-read/{email_id}", response_class=HTMLResponse)
async def track_email_read(
    email_id: int,
    sig: str = Query(..., description="HMAC-SHA256 signature"),
):
    expected_sig = _compute_sig(email_id)
    if not hmac.compare_digest(expected_sig, sig):
        return HTMLResponse(
            content=_error_page("Invalid Link", "This confirmation link is not valid or has expired.", "red"),
            status_code=404,
        )

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, read_at FROM email_reads WHERE email_id = %s",
                (email_id,),
            )
            record = cursor.fetchone()

            if not record:
                return HTMLResponse(
                    content=_error_page(
                        "Email Not Found",
                        f"No email with ID {email_id} exists in our system.",
                        "orange",
                    ),
                    status_code=404,
                )

            if not record["read_at"]:
                cursor.execute(
                    "UPDATE email_reads SET read_at = %s WHERE email_id = %s",
                    (datetime.utcnow(), email_id),
                )
                conn.commit()
                status_message = "Email confirmed successfully!"
            else:
                status_message = "Email was already confirmed."

    return HTMLResponse(content=_success_page(status_message, email_id))


@router.get("/pending")
async def fetch_new_reads(x_api_key: Annotated[str, Header()] = None):
    verify_api_key(x_api_key)

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, email_id, read_at, created_at
                FROM email_reads
                WHERE processed = 0 AND read_at IS NOT NULL
                ORDER BY created_at ASC
                """,
            )
            reads = cursor.fetchall()

    return {
        "status": "success",
        "count":  len(reads),
        "reads":  reads,
    }


@router.post("/acknowledge")
async def mark_reads_processed(
    request: MarkProcessedRequest,
    x_api_key: Annotated[str, Header()] = None,
):
    verify_api_key(x_api_key)

    if not request.read_ids:
        return {"status": "success", "message": "No IDs to process"}

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            placeholders = ",".join(["%s"] * len(request.read_ids))
            cursor.execute(
                f"UPDATE email_reads SET processed = 1 WHERE id IN ({placeholders})",
                request.read_ids,
            )
            processed_count = cursor.rowcount
        conn.commit()

    return {
        "status":          "success",
        "processed_count": processed_count,
        "message":         f"Successfully marked {processed_count} reads as processed",
    }


# ── HTML helpers ──────────────────────────────────────────────────────────────

def _base_page(icon: str, icon_bg: str, title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }}
    .container {{
      background: white; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.1);
      padding: 40px; text-align: center; max-width: 400px;
    }}
    .icon {{
      width: 50px; height: 50px; background: {icon_bg}; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px; color: white; font-size: 24px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">{icon}</div>
    <h1>{title}</h1>
    {body}
  </div>
</body>
</html>"""


def _success_page(message: str, email_id: int) -> str:
    return _base_page(
        "✓", "#10b981", "Email Confirmed!",
        f"<p>{message}</p><p><small>Email ID: {email_id} | {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</small></p>",
    )


def _error_page(title: str, detail: str, color: str) -> str:
    color_map = {"red": "#ef4444", "orange": "#f59e0b"}
    icon = "✕" if color == "red" else "!"
    return _base_page(icon, color_map.get(color, "#ef4444"), title, f"<p>{detail}</p>")