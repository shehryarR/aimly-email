import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager

DATABASE_NAME = os.getenv("MICROSERVICE_DB_PATH", "./email_microservice.db")


@contextmanager
def get_db_connection():
    db_path = Path(DATABASE_NAME).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ── Backends ──────────────────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backends (
                backend_id TEXT PRIMARY KEY,
                api_key    TEXT UNIQUE NOT NULL,
                name       TEXT NOT NULL,
                active     BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Read Receipts ─────────────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_reads (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                backend_id TEXT    NOT NULL,
                email_id   INTEGER NOT NULL,
                read_at    TIMESTAMP,                  -- NULL until first open
                processed  BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (backend_id) REFERENCES backends(backend_id)
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_email_reads_backend_processed
            ON email_reads(backend_id, processed)
        """)

        # ── Opt-Outs / Unsubscribes ───────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_optouts (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                backend_id     TEXT NOT NULL,
                sender_email   TEXT NOT NULL,
                receiver_email TEXT NOT NULL,
                opted_out_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (backend_id) REFERENCES backends(backend_id),
                UNIQUE (backend_id, sender_email, receiver_email)
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_email_optouts_lookup
            ON email_optouts(backend_id, sender_email, receiver_email)
        """)

        conn.commit()
        print("✅ Database initialised")