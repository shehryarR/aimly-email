import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Annotated
from datetime import datetime
from database import get_db_connection

router = APIRouter(prefix="/read-receipt", tags=["Read Receipt"])


# ── Models ────────────────────────────────────────────────────────────────────

class AddEmailRequest(BaseModel):
    email_id: int

class MarkProcessedRequest(BaseModel):
    read_ids: List[int]


# ── Auth & signing helpers ────────────────────────────────────────────────────

def _get_backend_api_key(backend_id: str) -> str:
    """Fetch the raw API key for a backend — used as the HMAC signing secret."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT api_key FROM backends WHERE backend_id = ? AND active = TRUE",
            (backend_id,),
        )
        result = cursor.fetchone()
        if not result:
            return None
        return result[0]


def _compute_sig(api_key: str, backend_id: str, email_id: int) -> str:
    """HMAC-SHA256 over backend_id + email_id, keyed by the backend API key."""
    msg = f"{backend_id}{email_id}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


def verify_backend_api_key(x_api_key: Annotated[str, Header()]):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT backend_id FROM backends WHERE api_key = ? AND active = TRUE",
            (x_api_key,),
        )
        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return result[0]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
async def add_email(
    request: AddEmailRequest,
    backend_id: str = Depends(verify_backend_api_key),
):
    """
    Register an email for read-tracking. Call this when you send an email.
    Use the returned track_url as the tracking pixel src in your email.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM email_reads WHERE backend_id = ? AND email_id = ?",
            (backend_id, request.email_id),
        )
        if cursor.fetchone():
            return {
                "status": "already_exists",
                "backend_id": backend_id,
                "email_id": request.email_id,
                "message": "Email already registered",
            }

        cursor.execute(
            """
            INSERT INTO email_reads (backend_id, email_id, read_at, processed, created_at)
            VALUES (?, ?, NULL, FALSE, ?)
            """,
            (backend_id, request.email_id, datetime.utcnow()),
        )
        conn.commit()

    return {
        "status": "success",
        "backend_id": backend_id,
        "email_id": request.email_id,
        "message": "Email registered successfully",
    }


@router.get("/mark-read/{backend_id}/{email_id}", response_class=HTMLResponse)
async def track_email_read(
    backend_id: str,
    email_id: int,
    sig: str = Query(..., description="HMAC-SHA256 signature"),
):
    """
    Pixel / link endpoint embedded in outgoing emails.
    Requires a valid HMAC-SHA256 sig — unsigned or tampered URLs are rejected.

    Your sending backend gets the signed track_url from /add-email response, or
    generate it manually:
      sig = hmac.new(api_key.encode(), f"{backend_id}{email_id}".encode(), sha256).hexdigest()
      url = f"/read-receipt/track/{backend_id}/{email_id}?sig={sig}"
    """
    # Fetch backend API key — same 404 for invalid backend_id and bad sig to prevent enumeration
    api_key = _get_backend_api_key(backend_id)
    if not api_key:
        return HTMLResponse(
            content=_error_page("Invalid Link", "This confirmation link is not valid or has expired.", "red"),
            status_code=404,
        )

    # Verify signature
    expected_sig = _compute_sig(api_key, backend_id, email_id)
    if not hmac.compare_digest(expected_sig, sig):
        return HTMLResponse(
            content=_error_page("Invalid Link", "This confirmation link is not valid or has expired.", "red"),
            status_code=404,
        )

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, read_at FROM email_reads WHERE backend_id = ? AND email_id = ?",
            (backend_id, email_id),
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

        if not record[1]:  # read_at is NULL → first open
            cursor.execute(
                "UPDATE email_reads SET read_at = ? WHERE backend_id = ? AND email_id = ?",
                (datetime.utcnow(), backend_id, email_id),
            )
            conn.commit()
            status_message = "Email confirmed successfully!"
        else:
            status_message = "Email was already confirmed."

    return HTMLResponse(content=_success_page(status_message, email_id))


@router.get("/pending")
async def fetch_new_reads(backend_id: str = Depends(verify_backend_api_key)):
    """Fetch all read events that haven't been synced to your backend yet."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, email_id, read_at, created_at
            FROM email_reads
            WHERE backend_id = ? AND processed = FALSE AND read_at IS NOT NULL
            ORDER BY created_at ASC
            """,
            (backend_id,),
        )
        reads = [
            {"id": r[0], "email_id": r[1], "read_at": r[2], "created_at": r[3]}
            for r in cursor.fetchall()
        ]

    return {"status": "success", "backend_id": backend_id, "count": len(reads), "reads": reads}


@router.post("/acknowledge")
async def mark_reads_processed(
    request: MarkProcessedRequest,
    backend_id: str = Depends(verify_backend_api_key),
):
    """Mark a batch of read events as processed so they won't appear in the next fetch."""
    if not request.read_ids:
        return {"status": "success", "backend_id": backend_id, "message": "No IDs to process"}

    with get_db_connection() as conn:
        cursor = conn.cursor()
        placeholders = ",".join(["?" for _ in request.read_ids])

        cursor.execute(
            f"SELECT COUNT(*) FROM email_reads WHERE id IN ({placeholders}) AND backend_id = ?",
            request.read_ids + [backend_id],
        )
        if cursor.fetchone()[0] != len(request.read_ids):
            raise HTTPException(status_code=403, detail="Some read IDs don't belong to your backend")

        cursor.execute(
            f"UPDATE email_reads SET processed = TRUE WHERE id IN ({placeholders}) AND backend_id = ?",
            request.read_ids + [backend_id],
        )
        processed_count = cursor.rowcount
        conn.commit()

    return {
        "status": "success",
        "backend_id": backend_id,
        "processed_count": processed_count,
        "message": f"Successfully marked {processed_count} reads as processed",
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