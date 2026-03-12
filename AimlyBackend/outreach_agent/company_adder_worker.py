"""
company_adder_worker.py — Background worker for AI-powered company discovery.

Runs as a daemon thread. Every POLL_INTERVAL seconds it checks for users
with company_addition_active > 0 and processes their queued AI search jobs.

Each user's job runs in its own thread (parallel processing).

Crash recovery:
  - If server crashes mid-job, company_addition_active remains > 0 in DB
  - On restart, this worker picks up the job and resumes from the remaining count
  - Companies already inserted are caught by the DB unique constraint
"""

import json
import threading
import time
import traceback
import asyncio
from typing import Optional

from core.database.connection import get_connection
from services.company_service import find_companies_by_query
from routes.user_keys import _decrypt_key

# ── Config ────────────────────────────────────────────────────────────────────

POLL_INTERVAL = 30    # seconds between checks
BATCH_SIZE    = 10    # hardcoded companies per batch


# =============================================================================
# WORKER CLASS
# =============================================================================

class CompanyAdderWorker:

    def __init__(self):
        self.running       = False
        self.thread        = None
        self._active_users = set()   # track which user_ids are currently being processed
        self._lock         = threading.Lock()
        print("🏢 Company Adder Worker initialised")

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        if not self.running:
            self.running = True
            self.thread  = threading.Thread(target=self._run, daemon=True)
            self.thread.start()
            print("▶️  Company Adder Worker started")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        print("⏹️  Company Adder Worker stopped")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _run(self):
        while self.running:
            try:
                self._check_and_process()
            except Exception as exc:
                print(f"❌ Company Adder Worker error: {exc}")
                traceback.print_exc()
            time.sleep(POLL_INTERVAL)

    # ── Poll DB for pending jobs ───────────────────────────────────────────────

    def _check_and_process(self):
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, company_addition_active, company_addition_metadata
                FROM users
                WHERE company_addition_active > 0
                  AND company_addition_metadata IS NOT NULL
                  AND company_addition_metadata != ''
            """)
            pending = [dict(row) for row in cursor.fetchall()]

        if not pending:
            return

        print(f"🏢 Company Adder: {len(pending)} user job(s) pending")

        for user_job in pending:
            user_id = user_job["id"]

            # Skip users already being processed in a running thread
            with self._lock:
                if user_id in self._active_users:
                    print(f"⏭️  User {user_id} already being processed — skipping")
                    continue
                self._active_users.add(user_id)

            # Spawn a thread per user — parallel processing
            t = threading.Thread(
                target=self._process_user_job,
                args=(user_job,),
                daemon=True,
            )
            t.start()

    # ── Per-user job ──────────────────────────────────────────────────────────

    def _process_user_job(self, user_job: dict):
        user_id  = user_job["id"]
        remaining = user_job["company_addition_active"]

        try:
            # ── Parse metadata ─────────────────────────────────────────────────
            try:
                metadata = json.loads(user_job["company_addition_metadata"])
            except (json.JSONDecodeError, TypeError):
                print(f"❌ User {user_id}: Invalid metadata JSON — resetting")
                self._reset_user(user_id)
                return

            query               = metadata.get("query", "").strip()
            campaign_id         = metadata.get("campaign_id")
            include_phone       = metadata.get("include_phone", False)
            include_address     = metadata.get("include_address", False)
            include_company_info = metadata.get("include_company_info", False)

            if not query:
                print(f"❌ User {user_id}: Empty query in metadata — resetting")
                self._reset_user(user_id)
                return

            # ── Load API keys from metadata (encrypted at job-queue time) ─────
            try:
                llm_api_key    = _decrypt_key(metadata["llm_api_key_enc"])
                tavily_api_key = _decrypt_key(metadata["tavily_api_key_enc"])
            except Exception:
                print(f"❌ User {user_id}: Failed to decrypt API keys from metadata — resetting")
                self._reset_user(user_id)
                return

            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = ?", (user_id,))
                keys = cursor.fetchone()

            if not keys or not keys["llm_model"]:
                print(f"❌ User {user_id}: Missing llm_model — resetting")
                self._reset_user(user_id)
                return

            llm_config = {
                "api_key": llm_api_key,
                "model":   keys["llm_model"],
            }

            print(f"🚀 User {user_id}: Starting batch — {remaining} companies remaining, batch size {BATCH_SIZE}")

            # ── Define callbacks ───────────────────────────────────────────────

            def check_company_exists(email: str) -> bool:
                """Return True if this email already exists for this user in DB."""
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id FROM companies WHERE user_id = ? AND email = ?",
                        (user_id, email.lower().strip())
                    )
                    return cursor.fetchone() is not None

            def add_company(company: dict) -> None:
                """Insert company into DB immediately and decrement counter.
                Uses a subquery to atomically check active flag — if the job
                was cancelled (active=0) between discovery and insertion,
                the INSERT produces 0 rows and the company is silently dropped.
                """
                with get_connection() as conn:
                    cursor = conn.cursor()
                    try:
                        cursor.execute("""
                            INSERT INTO companies (user_id, name, email, phone_number, address, company_info)
                            SELECT ?, ?, ?, ?, ?, ?
                            WHERE (SELECT company_addition_active FROM users WHERE id = ?) > 0
                        """, (
                            user_id,
                            company.get("name"),
                            company.get("email"),
                            company.get("phone_number"),
                            company.get("address"),
                            company.get("company_info"),
                            user_id,
                        ))

                        if cursor.rowcount == 0:
                            print(f"⛔ User {user_id}: Insert skipped — job was cancelled")
                            return

                        company_id_inserted = cursor.lastrowid

                        # Link to campaign if provided.
                        # INSERT OR IGNORE handles the already-linked edge case.
                        # Runs in the same transaction as company insert + decrement
                        # — all three commit together or not at all.
                        if campaign_id is not None:
                            cursor.execute("""
                                INSERT OR IGNORE INTO campaign_company (campaign_id, company_id)
                                VALUES (?, ?)
                            """, (campaign_id, company_id_inserted))

                        # Decrement counter
                        cursor.execute("""
                            UPDATE users
                            SET company_addition_active = MAX(0, company_addition_active - 1)
                            WHERE id = ?
                        """, (user_id,))

                        conn.commit()
                        print(f"✅ User {user_id}: Inserted {company.get('name')} — {company.get('email')}")

                    except Exception as insert_exc:
                        conn.rollback()
                        print(f"⚠️  User {user_id}: Insert failed for {company.get('email')}: {insert_exc}")

            def should_stop() -> bool:
                """Return True if the job was cancelled or reset — agent exits immediately."""
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT company_addition_active FROM users WHERE id = ?",
                        (user_id,)
                    )
                    row = cursor.fetchone()
                    return not row or row["company_addition_active"] <= 0

            # ── Run discovery for one batch ────────────────────────────────────
            asyncio.run(find_companies_by_query(
                query=query,
                tavily_api_key=tavily_api_key,
                llm_config=llm_config,
                limit=min(BATCH_SIZE, remaining),
                check_company_exists=check_company_exists,
                add_company=add_company,
                should_stop=should_stop,
                include_phone=include_phone,
                include_address=include_address,
                include_company_info=include_company_info,
            ))

            # ── Check if job is complete ───────────────────────────────────────
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT company_addition_active FROM users WHERE id = ?",
                    (user_id,)
                )
                row = cursor.fetchone()
                still_remaining = row["company_addition_active"] if row else 0

            if still_remaining <= 0:
                print(f"🎯 User {user_id}: Job complete — cleaning up")
                self._reset_user(user_id)
            else:
                print(f"🔄 User {user_id}: {still_remaining} companies still remaining — will resume next poll")

        except Exception as exc:
            print(f"❌ User {user_id}: Job failed — {exc}")
            traceback.print_exc()
            self._reset_user(user_id)

        finally:
            with self._lock:
                self._active_users.discard(user_id)

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def _reset_user(self, user_id: int) -> None:
        """Reset company addition state for a user — called on completion or failure."""
        try:
            with get_connection() as conn:
                conn.execute("""
                    UPDATE users
                    SET company_addition_active = 0,
                        company_addition_metadata = NULL
                    WHERE id = ?
                """, (user_id,))
                conn.commit()
            print(f"🔄 User {user_id}: company_addition_active reset to 0")
        except Exception as exc:
            print(f"❌ User {user_id}: Failed to reset flag — {exc}")


# =============================================================================
# SINGLETON
# =============================================================================

company_adder_worker = CompanyAdderWorker()