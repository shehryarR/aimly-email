import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import HTMLResponse
from typing import Annotated
from datetime import datetime
from database import get_db_connection

router = APIRouter(prefix="/optout", tags=["Opt-Out / Unsubscribe"])


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


def _compute_sig(api_key: str, backend_id: str, sender_email: str, receiver_email: str) -> str:
    """HMAC-SHA256 over backend_id + sender_email + receiver_email, keyed by the backend API key."""
    msg = f"{backend_id}{sender_email}{receiver_email}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


def verify_backend_api_key(x_api_key: Annotated[str, Header()]):
    """Verify API key for the /check endpoint and return backend_id."""
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

@router.get("/unsubscribe/{backend_id}/{sender_email}/{receiver_email}", response_class=HTMLResponse)
async def unsubscribe(
    backend_id: str,
    sender_email: str,
    receiver_email: str,
    sig: str = Query(..., description="HMAC-SHA256 signature"),
):
    """
    One-click unsubscribe link embedded in outgoing emails.
    The sig param is HMAC-SHA256(api_key, backend_id + sender_email + receiver_email).

    Your sending backend generates the URL like:
      sig = hmac.new(api_key.encode(), f"{backend_id}{sender}{receiver}".encode(), sha256).hexdigest()
      url = f"/optout/unsubscribe/{backend_id}/{sender}/{receiver}?sig={sig}"
    """
    # Fetch the backend's API key to use as signing secret
    api_key = _get_backend_api_key(backend_id)
    if not api_key:
        return HTMLResponse(
            content=_error_page("Invalid Link", "This unsubscribe link is not valid or has expired."),
            status_code=404,
        )

    # Verify signature — rejects any forged or tampered URLs
    # Return 404 (same as invalid backend_id) to prevent enumeration via status code differences
    expected_sig = _compute_sig(api_key, backend_id, sender_email, receiver_email)
    if not hmac.compare_digest(expected_sig, sig):
        return HTMLResponse(
            content=_error_page("Invalid Link", "This unsubscribe link is not valid or has expired."),
            status_code=404,
        )

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id FROM email_optouts
            WHERE backend_id = ? AND sender_email = ? AND receiver_email = ?
            """,
            (backend_id, sender_email, receiver_email),
        )

        if cursor.fetchone():
            message = "You have already unsubscribed. No further action needed."
        else:
            cursor.execute(
                """
                INSERT INTO email_optouts (backend_id, sender_email, receiver_email, opted_out_at)
                VALUES (?, ?, ?, ?)
                """,
                (backend_id, sender_email, receiver_email, datetime.utcnow()),
            )
            conn.commit()
            message = "You have been successfully unsubscribed."

    return HTMLResponse(content=_success_page(message, sender_email, receiver_email))


@router.get("/check")
async def check_optout(
    sender_email: str,
    receiver_email: str,
    backend_id: str = Depends(verify_backend_api_key),
):
    """
    Check whether a receiver has unsubscribed from a specific sender under this backend.
    Secured with X-Api-Key header (backend API key).

    Query params: ?sender_email=...&receiver_email=...
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT opted_out_at FROM email_optouts
            WHERE backend_id = ? AND sender_email = ? AND receiver_email = ?
            """,
            (backend_id, sender_email, receiver_email),
        )
        result = cursor.fetchone()

    if result:
        return {
            "status": "opted_out",
            "backend_id": backend_id,
            "sender_email": sender_email,
            "receiver_email": receiver_email,
            "opted_out_at": result[0],
            "should_send": False,
        }

    return {
        "status": "subscribed",
        "backend_id": backend_id,
        "sender_email": sender_email,
        "receiver_email": receiver_email,
        "should_send": True,
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
      padding: 40px; text-align: center; max-width: 420px;
    }}
    .icon {{
      width: 50px; height: 50px; background: {icon_bg}; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px; color: white; font-size: 24px;
    }}
    small {{ color: #6b7280; }}
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


def _success_page(message: str, sender_email: str, receiver_email: str) -> str:
    return _base_page(
        "✓", "#10b981", "Unsubscribed",
        f"""<p>{message}</p>
        <p><small>
          From: {sender_email}<br>
          To: {receiver_email}<br>
          {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
        </small></p>""",
    )


def _error_page(title: str, detail: str) -> str:
    return _base_page("✕", "#ef4444", title, f"<p>{detail}</p>")