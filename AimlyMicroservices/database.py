import os
import pymysql
import pymysql.cursors
from contextlib import contextmanager


@contextmanager
def get_db_connection():
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "mysql"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("MICROSERVICE_DB_USER", "aimly_microservice"),
        password=os.getenv("MICROSERVICE_DB_PASSWORD"),
        database=os.getenv("DB_NAME", "aimly_microservice"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=30,
    )
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    with get_db_connection() as conn:
        with conn.cursor() as cursor:

            # ── Backends ──────────────────────────────────────────────────────
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS backends (
                    backend_id VARCHAR(100) PRIMARY KEY,
                    api_key    VARCHAR(255) UNIQUE NOT NULL,
                    name       VARCHAR(255) NOT NULL,
                    active     TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Read Receipts ─────────────────────────────────────────────────
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_reads (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    backend_id VARCHAR(100) NOT NULL,
                    email_id   INT NOT NULL,
                    read_at    TIMESTAMP NULL DEFAULT NULL,
                    processed  TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (backend_id) REFERENCES backends(backend_id),
                    INDEX idx_email_reads_backend_processed (backend_id, processed)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # ── Opt-Outs / Unsubscribes ───────────────────────────────────────
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_optouts (
                    id             INT AUTO_INCREMENT PRIMARY KEY,
                    backend_id     VARCHAR(100) NOT NULL,
                    sender_email   VARCHAR(255) NOT NULL,
                    receiver_email VARCHAR(255) NOT NULL,
                    opted_out_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (backend_id) REFERENCES backends(backend_id),
                    UNIQUE KEY uq_optout (backend_id, sender_email, receiver_email),
                    INDEX idx_email_optouts_lookup (backend_id, sender_email, receiver_email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

        conn.commit()
        print("✅ Database initialised")