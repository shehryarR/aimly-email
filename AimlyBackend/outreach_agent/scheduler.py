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
                print(f"🕐 Due: email ID={email['id']}")
                self._dispatch_email(email["id"], email["user_id"])
            except Exception as exc:
                print(f"❌ Error processing email {email['id']}: {exc}")
                traceback.print_exc()

    def _dispatch_email(self, email_id: int, user_id: int):
        """Call the send endpoint internally using the internal API key."""
        headers = {
            "X-Internal-Key": INTERNAL_API_KEY,
            "X-User-Id":      str(user_id),
        }

        with httpx.Client() as client:
            response = client.post(
                f"{BASE_URL}/email/{email_id}/send/",
                headers=headers,
                json={},       # no scheduled time = send immediately
                timeout=60.0,
            )

        if response.status_code == 200:
            print(f"✅ Email {email_id} dispatched successfully")
        else:
            print(f"❌ Email {email_id} dispatch failed: {response.status_code} — {response.text}")


# =============================================================================
# SINGLETON
# =============================================================================

email_scheduler = EmailScheduler()