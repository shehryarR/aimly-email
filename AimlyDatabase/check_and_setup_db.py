"""
AimlyDatabase/check_and_setup_db.py
Checks if the database is already initialised.

Behaviour:
  - If DB does not exist or has no users table → runs full setup
  - If DB exists but is missing tables (e.g. new tables added in backend.sql)
    → applies backend.sql again (all statements use CREATE TABLE IF NOT EXISTS,
      so existing tables are untouched and only missing ones get created)
  - If DB is fully up to date → skips silently

This means re-running `make up` after adding new tables to backend.sql
will automatically create them without wiping existing data.
"""

import sys
import os
import time
from pathlib import Path

ROOT_DIR   = Path(__file__).parent.parent
ENV_PATH   = ROOT_DIR / ".env"
SCHEMA_DIR = Path(__file__).parent / "schema"

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("  ❌  pymysql not installed. Run: pip install pymysql cryptography")
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def get_existing_tables(host, port, root_password, db_name) -> set:
    """Return set of table names that currently exist in the database."""
    try:
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user="root",
            password=root_password,
            database=db_name,
            connect_timeout=5,
        )
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        return tables
    except Exception:
        return set()


def get_expected_tables(sql_path: Path) -> set:
    """
    Parse backend.sql and extract all table names from
    CREATE TABLE IF NOT EXISTS statements.
    """
    tables = set()
    if not sql_path.exists():
        return tables
    for line in sql_path.read_text().splitlines():
        line = line.strip()
        upper = line.upper()
        if upper.startswith("CREATE TABLE IF NOT EXISTS"):
            # Extract table name — strip backticks and spaces
            parts = line.split()
            if len(parts) >= 6:
                table_name = parts[5].strip('`()').strip()
                if table_name:
                    tables.add(table_name)
    return tables


def db_exists(host, port, root_password, db_name) -> bool:
    """Return True if the database exists."""
    try:
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user="root",
            password=root_password,
            connect_timeout=5,
        )
        with conn.cursor() as cursor:
            cursor.execute("SHOW DATABASES LIKE %s", (db_name,))
            exists = cursor.fetchone() is not None
        conn.close()
        return exists
    except Exception:
        return False


def apply_schema(container, schema_path, db_user, db_password, db_name, label):
    """Apply a SQL schema file via docker exec (same as setup_db.py)."""
    import subprocess

    dest = f"/tmp/{schema_path.name}"

    cp = subprocess.run(
        ["docker", "cp", str(schema_path), f"{container}:{dest}"],
        capture_output=True, text=True,
    )
    if cp.returncode != 0:
        print(f"  ❌  Failed to copy {label} to container: {cp.stderr}")
        sys.exit(1)

    ex = subprocess.run(
        [
            "docker", "exec", "-i", container,
            "mysql",
            f"-u{db_user}",
            f"-p{db_password}",
            db_name,
            "-e", f"source {dest}",
        ],
        capture_output=True, text=True,
    )

    errors = "\n".join(
        line for line in ex.stderr.splitlines()
        if "password" not in line.lower() and line.strip()
    )
    if ex.returncode != 0 and errors:
        print(f"  ❌  {label} failed:\n{errors}")
        sys.exit(1)

    print(f"  ✅  {label} applied")


def get_mysql_container_name() -> str:
    import subprocess
    result = subprocess.run(
        ["docker", "ps", "--filter", "ancestor=mysql:8.0", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    )
    names = result.stdout.strip().splitlines()
    if names:
        return names[0]
    result = subprocess.run(
        ["docker", "ps", "--filter", "name=mysql", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    )
    names = result.stdout.strip().splitlines()
    return names[0] if names else None


# ── Main ──────────────────────────────────────────────────────────────────────

db_host_for_setup    = "127.0.0.1"
db_port              = read_env_var("DB_PORT") or "3306"
mysql_root_password  = read_env_var("MYSQL_ROOT_PASSWORD") or ""
backend_db_name      = read_env_var("BACKEND_DB_NAME") or "aimly_backend"
backend_db_user      = read_env_var("BACKEND_DB_USER") or ""
backend_db_password  = read_env_var("BACKEND_DB_PASSWORD") or ""

if not mysql_root_password:
    print("  ❌  MYSQL_ROOT_PASSWORD not set in .env")
    sys.exit(1)

print()
print("  🔍  Checking database initialisation...")

if not wait_for_mysql(db_host_for_setup, db_port, mysql_root_password):
    print("  ❌  Could not connect to MySQL.")
    sys.exit(1)

backend_sql = SCHEMA_DIR / "backend.sql"

# ── Case 1: DB doesn't exist at all → full setup ─────────────────────────────
if not db_exists(db_host_for_setup, db_port, mysql_root_password, backend_db_name):
    print("  ⚙️   Database not initialised — running full setup...")
    print()
    setup_path = Path(__file__).parent / "setup_db.py"
    exec(setup_path.read_text(), {"__file__": str(setup_path)})
    sys.exit(0)

# ── Case 2: DB exists — check for missing tables ──────────────────────────────
existing_tables = get_existing_tables(
    db_host_for_setup, db_port, mysql_root_password, backend_db_name
)
expected_tables = get_expected_tables(backend_sql)
missing_tables  = expected_tables - existing_tables

if not missing_tables:
    print(f"  ✅  Database up to date ({len(existing_tables)} tables) — skipping setup")
    print()
    sys.exit(0)

# ── Case 3: DB exists but has missing tables → apply schema ──────────────────
print(f"  ⚠️   Found {len(missing_tables)} missing table(s): {', '.join(sorted(missing_tables))}")
print("  ⚙️   Applying backend.sql to create missing tables...")
print()

container = get_mysql_container_name()
if not container:
    print("  ❌  Could not find running MySQL container.")
    sys.exit(1)

apply_schema(
    container,
    backend_sql,
    backend_db_user,
    backend_db_password,
    backend_db_name,
    "backend.sql (missing tables)",
)

# Verify
now_existing = get_existing_tables(
    db_host_for_setup, db_port, mysql_root_password, backend_db_name
)
still_missing = expected_tables - now_existing
if still_missing:
    print(f"  ⚠️   Still missing after apply: {', '.join(sorted(still_missing))}")
else:
    print(f"  ✅  All {len(now_existing)} tables present")

print()