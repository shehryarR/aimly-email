"""
AimlyCompanyFinder/main.py
==========================
Standalone company discovery worker container.

Polls the aimly_backend DB every POLL_INTERVAL seconds for users with
company_addition_active > 0, then runs the AI discovery pipeline to
find and insert companies directly into the DB.

Replaces company_adder_worker.py from AimlyBackend — now runs as its
own independent Docker container with direct DB access.

Environment variables (from root .env via docker-compose env_file):
  BACKEND_DB_USER / BACKEND_DB_PASSWORD / DB_HOST / DB_PORT / BACKEND_DB_NAME
"""

import json
import threading
import time
import traceback
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ── Load env ──────────────────────────────────────────────────────────────────

def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)
    else:
        print(f"⚠️  Could not find .env at {env_path} — using system env vars")

load_env()

from core.database.connection import get_connection
from services.company_service import find_companies_by_query

# ── Config ────────────────────────────────────────────────────────────────────

POLL_INTERVAL = 30   # seconds between DB polls
BATCH_SIZE    = 10   # companies per batch


# =============================================================================
# DECRYPT HELPER
# =============================================================================

def _get_aes_key() -> bytes:
    """Derive AES-256 key from COOKIE_SECRET — must match backend's _get_aes_key."""
    secret = os.getenv("COOKIE_SECRET", "")
    if not secret:
        raise ValueError("COOKIE_SECRET not set in environment")
    try:
        key = bytes.fromhex(secret)
    except ValueError:
        raise ValueError("COOKIE_SECRET must be a valid hex string.")
    if len(key) != 32:
        raise ValueError(f"COOKIE_SECRET must decode to 32 bytes (got {len(key)}).")
    return key


def _decrypt_key(encrypted: str) -> str:
    """
    Decrypt an API key encrypted by AimlyBackend's _encrypt_key (AES-256-GCM).
    Must stay in sync with AimlyBackend/routes/user_keys.py.
    Format: URL-safe base64( nonce[12B] + ciphertext+tag )
    """
    import base64
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key   = _get_aes_key()
    raw   = base64.urlsafe_b64decode(encrypted.encode())
    nonce = raw[:12]
    ct    = raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode()


# =============================================================================
# WORKER
# =============================================================================

class CompanyFinderWorker:

    def __init__(self):
        self.running       = False
        self.thread        = None
        self._active_users = set()
        self._lock         = threading.Lock()
        print("🏢 Company Finder Worker initialised")

    def start(self):
        self.running = True
        self.thread  = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        print("▶️  Company Finder Worker started")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        print("⏹️  Company Finder Worker stopped")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _run(self):
        while self.running:
            try:
                self._check_and_process()
            except Exception as exc:
                print(f"❌ Worker error: {exc}")
                traceback.print_exc()
            time.sleep(POLL_INTERVAL)

    # ── Poll DB ───────────────────────────────────────────────────────────────

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

        print(f"🏢 {len(pending)} pending job(s)")

        for user_job in pending:
            user_id = user_job["id"]

            with self._lock:
                if user_id in self._active_users:
                    print(f"⏭️  User {user_id} already processing — skipping")
                    continue
                self._active_users.add(user_id)

            t = threading.Thread(
                target=self._process_user_job,
                args=(user_job,),
                daemon=True,
            )
            t.start()

    # ── Per-user job ──────────────────────────────────────────────────────────

    def _process_user_job(self, user_job: dict):
        user_id   = user_job["id"]
        remaining = user_job["company_addition_active"]

        try:
            # ── Parse metadata ─────────────────────────────────────────────────
            try:
                metadata = json.loads(user_job["company_addition_metadata"])
            except (json.JSONDecodeError, TypeError):
                print(f"❌ User {user_id}: Invalid metadata JSON — resetting")
                self._reset_user(user_id)
                return

            query                = metadata.get("query", "").strip()
            campaign_id          = metadata.get("campaign_id")
            include_phone        = metadata.get("include_phone", False)
            include_address      = metadata.get("include_address", False)
            include_company_info = metadata.get("include_company_info", False)

            if not query:
                print(f"❌ User {user_id}: Empty query — resetting")
                self._reset_user(user_id)
                return

            # ── Decrypt API keys ───────────────────────────────────────────────
            try:
                llm_api_key    = _decrypt_key(metadata["llm_api_key_enc"])
                tavily_api_key = _decrypt_key(metadata["tavily_api_key_enc"])
            except Exception:
                print(f"❌ User {user_id}: Failed to decrypt API keys — resetting")
                self._reset_user(user_id)
                return

            # ── Load LLM model from DB ─────────────────────────────────────────
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT llm_model FROM user_keys WHERE user_id = %s", (user_id,))
                keys = cursor.fetchone()

            if not keys or not keys["llm_model"]:
                print(f"❌ User {user_id}: Missing llm_model — resetting")
                self._reset_user(user_id)
                return

            llm_config = {
                "api_key": llm_api_key,
                "model":   keys["llm_model"],
            }

            print(f"🚀 User {user_id}: {remaining} companies remaining, batch size {BATCH_SIZE}")

            # ── Callbacks ──────────────────────────────────────────────────────

            def check_company_exists(email: str) -> bool:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id FROM companies WHERE user_id = %s AND email = %s",
                        (user_id, email.lower().strip())
                    )
                    return cursor.fetchone() is not None

            def add_company(company: dict) -> None:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    try:
                        cursor.execute("""
                            INSERT INTO companies (user_id, name, email, phone_number, address, company_info)
                            SELECT %s, %s, %s, %s, %s, %s
                            WHERE (SELECT company_addition_active FROM users WHERE id = %s) > 0
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

                        if campaign_id is not None:
                            cursor.execute("""
                                INSERT IGNORE INTO campaign_company (campaign_id, company_id)
                                VALUES (%s, %s)
                            """, (campaign_id, company_id_inserted))

                        cursor.execute("""
                            UPDATE users
                            SET company_addition_active = GREATEST(0, company_addition_active - 1)
                            WHERE id = %s
                        """, (user_id,))

                        conn.commit()
                        print(f"✅ User {user_id}: Inserted {company.get('name')} — {company.get('email')}")

                    except Exception as insert_exc:
                        conn.rollback()
                        print(f"⚠️  User {user_id}: Insert failed for {company.get('email')}: {insert_exc}")

            def should_stop() -> bool:
                with get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT company_addition_active FROM users WHERE id = %s",
                        (user_id,)
                    )
                    row = cursor.fetchone()
                    return not row or row["company_addition_active"] <= 0

            # ── Run discovery ──────────────────────────────────────────────────
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

            # ── Check if complete ──────────────────────────────────────────────
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT company_addition_active FROM users WHERE id = %s", (user_id,)
                )
                row = cursor.fetchone()
                still_remaining = row["company_addition_active"] if row else 0

            if still_remaining <= 0:
                print(f"🎯 User {user_id}: Job complete")
                self._reset_user(user_id)
            else:
                print(f"🔄 User {user_id}: {still_remaining} remaining — will resume next poll")

        except Exception as exc:
            print(f"❌ User {user_id}: Job failed — {exc}")
            traceback.print_exc()
            self._reset_user(user_id)

        finally:
            with self._lock:
                self._active_users.discard(user_id)

    def _reset_user(self, user_id: int) -> None:
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        UPDATE users
                        SET company_addition_active = 0,
                            company_addition_metadata = NULL
                        WHERE id = %s
                    """, (user_id,))
                conn.commit()
            print(f"🔄 User {user_id}: reset to 0")
        except Exception as exc:
            print(f"❌ User {user_id}: Failed to reset — {exc}")


# =============================================================================
# ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    print("🚀 AimlyCompanyFinder starting...")

    worker = CompanyFinderWorker()
    worker.start()

    print("✅ Worker running — polling every", POLL_INTERVAL, "seconds")
    print("   Press Ctrl+C to stop")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        worker.stop()
        print("✅ Done")