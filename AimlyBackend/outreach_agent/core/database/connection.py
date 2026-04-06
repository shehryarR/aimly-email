"""
AimlyBackend/core/database/connection.py
DB connection for the backend.
Schema is owned by AimlyDatabase — never created here.
"""

import os
import pymysql
import pymysql.cursors


def get_connection() -> pymysql.connections.Connection:
    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "mysql"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("BACKEND_DB_USER", "aimly_backend"),
        password=os.getenv("BACKEND_DB_PASSWORD"),
        database=os.getenv("BACKEND_DB_NAME", "aimly_backend"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=30,
    )
    return conn


def reset_company_addition_flags() -> None:
    """
    Called once on server startup to recover from any crashed addition jobs.

    Rules:
      - company_addition_active = -1  → crashed JSON/CSV job → reset to 0, clear metadata
      - company_addition_active > 0 AND metadata IS NULL  → broken AI job → reset to 0
      - company_addition_active > 0 AND metadata IS NOT NULL  → valid AI job → leave for AimlyCompanyFinder
    """
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE users
                SET company_addition_active = 0,
                    company_addition_metadata = NULL
                WHERE company_addition_active = -1
            """)
            cursor.execute("""
                UPDATE users
                SET company_addition_active = 0
                WHERE company_addition_active > 0
                  AND (company_addition_metadata IS NULL OR company_addition_metadata = '')
            """)
        conn.commit()

    print("✅ Company addition flags reset on startup")