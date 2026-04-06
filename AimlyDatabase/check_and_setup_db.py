"""
AimlyDatabase/check_and_setup_db.py
Checks if the database is already initialised.
If yes  → skips silently.
If no   → runs the full setup (users + grants + schema).

Called by `make up` after MySQL is healthy.
"""

import sys
import os
import time
from pathlib import Path

ROOT_DIR  = Path(__file__).parent.parent
ENV_PATH  = ROOT_DIR / ".env"

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("  ❌  pymysql not installed. Run: pip install pymysql cryptography")
    sys.exit(1)


def read_env_var(key):
    if not ENV_PATH.exists():
        return None
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None


def wait_for_mysql(host, port, root_password, max_retries=10):
    for attempt in range(1, max_retries + 1):
        try:
            conn = pymysql.connect(
                host=host,
                port=int(port),
                user="root",
                password=root_password,
                connect_timeout=5,
            )
            conn.close()
            return True
        except Exception as e:
            print(f"  ⏳  Waiting for MySQL... attempt {attempt}/{max_retries}: {e}")
            time.sleep(5)
    return False


def is_initialised(host, port, root_password, backend_db_name) -> bool:
    """Return True if backend DB exists and has the users table."""
    try:
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user="root",
            password=root_password,
            connect_timeout=5,
        )
        with conn.cursor() as cursor:
            cursor.execute("SHOW DATABASES LIKE %s", (backend_db_name,))
            if not cursor.fetchone():
                return False
            cursor.execute(f"USE `{backend_db_name}`")
            cursor.execute("SHOW TABLES LIKE 'users'")
            if not cursor.fetchone():
                return False
        conn.close()
        return True
    except Exception:
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

db_host_for_setup   = "127.0.0.1"
db_port             = read_env_var("DB_PORT") or "3306"
mysql_root_password = read_env_var("MYSQL_ROOT_PASSWORD") or ""
backend_db_name     = read_env_var("BACKEND_DB_NAME") or "aimly_backend"

if not mysql_root_password:
    print("  ❌  MYSQL_ROOT_PASSWORD not set in .env")
    sys.exit(1)

print()
print("  🔍  Checking database initialisation...")

if not wait_for_mysql(db_host_for_setup, db_port, mysql_root_password):
    print("  ❌  Could not connect to MySQL.")
    sys.exit(1)

if is_initialised(db_host_for_setup, db_port, mysql_root_password, backend_db_name):
    print("  ✅  Database already initialised — skipping setup")
    print()
    sys.exit(0)

print("  ⚙️   Database not initialised — running setup...")
print()

# Run setup_db.py inline by importing and executing it
setup_path = Path(__file__).parent / "setup_db.py"
exec(setup_path.read_text(), {"__file__": str(setup_path)})