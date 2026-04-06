import hmac
import hashlib
import os
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import HTMLResponse
from typing import Annotated
from datetime import datetime
from database import get_db_connection

router = APIRouter(prefix="/optout", tags=["Opt-Out / Unsubscribe"])

MICROSERVICE_API_KEY = os.getenv("MICROSERVICE_API_KEY", "your-super-secure-microservice-key")


# ── Auth & signing helpers ────────────────────────────────────────────────────

def verify_api_key(x_api_key: Annotated[str, Header()]):
    if x_api_key != MICROSERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _compute_sig(sender_email: str, receiver_email: str) -> str:
    """HMAC-SHA256 over sender_email + receiver_email, keyed by MICROSERVICE_API_KEY."""
    msg = f"{sender_email}{receiver_email}".encode()
    return hmac.new(MICROSERVICE_API_KEY.encode(), msg, hashlib.sha256).hexdigest()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/unsubscribe/{sender_email}/{receiver_email}", response_class=HTMLResponse)
async def unsubscribe(
    sender_email: str,
    receiver_email: str,
    sig: str = Query(..., description="HMAC-SHA256 signature"),
):
    expected_sig = _compute_sig(sender_email, receiver_email)
    if not hmac.compare_digest(expected_sig, sig):
        return HTMLResponse(
            content=_error_page("Invalid Link", "This unsubscribe link is not valid or has expired."),
            status_code=404,
        )

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM email_optouts WHERE sender_email = %s AND receiver_email = %s",
                (sender_email, receiver_email),
            )

            if cursor.fetchone():
                message = "You have already unsubscribed. No further action needed."
            else:
                cursor.execute(
                    "INSERT INTO email_optouts (sender_email, receiver_email, opted_out_at) VALUES (%s, %s, %s)",
                    (sender_email, receiver_email, datetime.utcnow()),
                )
                conn.commit()
                message = "You have been successfully unsubscribed."

    return HTMLResponse(content=_success_page(message, sender_email, receiver_email))


@router.get("/check")
async def check_optout(
    sender_email: str,
    receiver_email: str,
    x_api_key: Annotated[str, Header()] = None,
):
    verify_api_key(x_api_key)

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT opted_out_at FROM email_optouts WHERE sender_email = %s AND receiver_email = %s",
                (sender_email, receiver_email),
            )
            result = cursor.fetchone()

    if result:
        return {
            "status":         "opted_out",
            "sender_email":   sender_email,
            "receiver_email": receiver_email,
            "opted_out_at":   result["opted_out_at"],
            "should_send":    False,
        }

    return {
        "status":         "subscribed",
        "sender_email":   sender_email,
        "receiver_email": receiver_email,
        "should_send":    True,
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