"""
AimlyCompanyFinder/core/database/connection.py
DB connection for the company finder container.
Uses BACKEND_DB_USER — same database as AimlyBackend (reads/writes companies table).
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