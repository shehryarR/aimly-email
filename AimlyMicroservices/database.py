"""
AimlyMicroservices/database.py
DB connection for the microservice.
Schema is owned by AimlyDatabase — never created here.
"""
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
        database=os.getenv("MICROSERVICE_DB_NAME", "aimly_microservice"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        connect_timeout=30,
    )
    try:
        yield conn
    finally:
        conn.close()