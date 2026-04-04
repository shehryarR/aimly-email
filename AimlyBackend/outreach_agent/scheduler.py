"""
scheduler.py — Background email scheduler.

Single daemon thread that checks every 30s for scheduled emails that are
due and dispatches them by calling the internal send endpoint.

Uses X-Internal-Key + X-User-Id headers to bypass JWT auth.
"""

import os
import threading
import time
import traceback
import httpx
from datetime import datetime, timezone
from core.database.connection import get_connection

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-secret-key")
APP_PORT         = int(os.getenv("APP_PORT", 8000))
BASE_URL         = f"http://localhost:{APP_PORT}"


class EmailScheduler:

    def __init__(self):
        self.running = False
        self.thread  = None
        print("📅 Email Scheduler initialised")

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        if not self.running:
            self.running = True
            self.thread  = threading.Thread(target=self._run_scheduler, daemon=True)
            self.thread.start()
            print("▶️  Email Scheduler started")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        print("⏹️  Email Scheduler stopped")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _run_scheduler(self):
        while self.running:
            try:
                self._check_and_send_emails()
            except Exception as exc:
                print(f"❌ Scheduler error: {exc}")
                traceback.print_exc()
            time.sleep(30)

    # ── Dispatch ──────────────────────────────────────────────────────────────

    def _check_and_send_emails(self):
        """Find emails with status='scheduled' that are due and send them."""
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT e.id, c.user_id
                FROM emails e
                JOIN campaign_company cc ON e.campaign_company_id = cc.id
                JOIN campaigns c ON cc.campaign_id = c.id
                WHERE e.status = 'scheduled'
                  AND (e.sent_at IS NULL OR e.sent_at <= CURRENT_TIMESTAMP)
            """)
            scheduled = [dict(row) for row in cursor.fetchall()]

        now = datetime.now(timezone.utc)
        print(f"📋 Checking {len(scheduled)} scheduled emails at {now.isoformat()}")

        for email in scheduled:
            try:
                self._dispatch_email(email["id"], email["user_id"])
            except Exception as exc:
                print(f"❌ Error processing email {email['id']}: {exc}")
                traceback.print_exc()

    def _dispatch_email(self, email_id: int, user_id: int):
        """Call the bulk-send endpoint internally using the internal API key."""
        headers = {
            "X-Internal-Key": INTERNAL_API_KEY,
            "X-User-Id":      str(user_id),
            "Content-Type":   "application/json",
        }

        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{BASE_URL}/email/bulk-send/",
                    headers=headers,
                    json={"email_ids": [email_id]},
                    timeout=60.0,
                )
        except Exception as exc:
            print(f"❌ Email {email_id} network error: {exc}")
            reason = "Unknown Error: You may retry later or report to us"
            try:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (email_id,))
                    cursor.execute(
                        "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                        (email_id, reason),
                    )
                    conn.commit()
            except Exception as db_exc:
                print(f"❌ Failed to mark email {email_id} as failed in DB: {db_exc}")
            return

        if response.status_code == 200:
            pass  # bulk-send handles status updates and logging internally

        else:
            reason = "Unknown Error: You may retry later or report to us"
            print(f"❌ Email {email_id} dispatch failed ({response.status_code}): {reason}")
            try:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("UPDATE emails SET status = 'failed' WHERE id = %s", (email_id,))
                    cursor.execute(
                        "INSERT INTO failed_emails (email_id, reason) VALUES (%s, %s)",
                        (email_id, reason),
                    )
                    conn.commit()
            except Exception as db_exc:
                print(f"❌ Failed to mark email {email_id} as failed in DB: {db_exc}")


# =============================================================================
# SINGLETON
# =============================================================================

email_scheduler = EmailScheduler()