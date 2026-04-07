"""
AimlyDatabase/setup_db.py
Connects to MySQL as root and:
  1. Creates databases (aimly_backend, aimly_microservice)
  2. Creates users with scoped grants
  3. Copies SQL files into the mysql container and executes them there
     (no mysql client required on host)
"""

import sys
import os
import time
import subprocess
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


def wait_for_mysql(host, port, root_password, max_retries=12):
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


def get_mysql_container_name() -> str:
    """Find the running MySQL container name."""
    result = subprocess.run(
        ["docker", "ps", "--filter", "ancestor=mysql:8.0", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    )
    name = result.stdout.strip().splitlines()
    if name:
        return name[0]
    # fallback: try by container name pattern
    result = subprocess.run(
        ["docker", "ps", "--filter", "name=mysql", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    )
    name = result.stdout.strip().splitlines()
    if name:
        return name[0]
    return None


def run_sql_file_in_container(
    sql_path: Path,
    container: str,
    user: str,
    password: str,
    database: str,
    label: str,
):
    """Copy SQL file into container and execute it via docker exec."""
    print(f"  ── Running {label} ──")

    # Copy SQL file into container
    dest = f"/tmp/{sql_path.name}"
    cp_result = subprocess.run(
        ["docker", "cp", str(sql_path), f"{container}:{dest}"],
        capture_output=True, text=True,
    )
    if cp_result.returncode != 0:
        print(f"  ❌  Failed to copy {label} to container: {cp_result.stderr}")
        sys.exit(1)

    # Execute SQL file inside container
    exec_result = subprocess.run(
        [
            "docker", "exec", "-i", container,
            "mysql",
            f"-u{user}",
            f"-p{password}",
            database,
            "-e", f"source {dest}",
        ],
        capture_output=True, text=True,
    )

    # Filter password warnings from stderr
    errors = "\n".join(
        line for line in exec_result.stderr.splitlines()
        if "password" not in line.lower() and line.strip()
    )

    if exec_result.returncode != 0 and errors:
        print(f"  ❌  {label} failed:\n{errors}")
        sys.exit(1)

    print(f"  ✅  {label} applied")


# ── Main ──────────────────────────────────────────────────────────────────────

print()
print("  ⚙️   DATABASE SETUP")
print("  " + "─" * 53)
print()

db_host_for_setup        = "127.0.0.1"
db_port                  = read_env_var("DB_PORT") or "3306"
mysql_root_password      = read_env_var("MYSQL_ROOT_PASSWORD") or ""
backend_db_name          = read_env_var("BACKEND_DB_NAME") or "aimly_backend"
microservice_db_name     = read_env_var("MICROSERVICE_DB_NAME") or "aimly_microservice"
backend_db_user          = read_env_var("BACKEND_DB_USER") or ""
backend_db_password      = read_env_var("BACKEND_DB_PASSWORD") or ""
microservice_db_user     = read_env_var("MICROSERVICE_DB_USER") or ""
microservice_db_password = read_env_var("MICROSERVICE_DB_PASSWORD") or ""

# Validate
missing = []
for name, val in [
    ("MYSQL_ROOT_PASSWORD",      mysql_root_password),
    ("BACKEND_DB_USER",          backend_db_user),
    ("BACKEND_DB_PASSWORD",      backend_db_password),
    ("MICROSERVICE_DB_USER",     microservice_db_user),
    ("MICROSERVICE_DB_PASSWORD", microservice_db_password),
]:
    if not val:
        missing.append(name)

if missing:
    print(f"  ❌  Missing required vars in .env: {', '.join(missing)}")
    sys.exit(1)

# Wait for MySQL
print(f"  ⏳  Connecting to MySQL at {db_host_for_setup}:{db_port} as root...")
if not wait_for_mysql(db_host_for_setup, db_port, mysql_root_password):
    print("  ❌  Could not connect to MySQL after multiple attempts.")
    sys.exit(1)

print("  ✅  MySQL is reachable")

# Find container
container = get_mysql_container_name()
if not container:
    print("  ❌  Could not find running MySQL container.")
    sys.exit(1)
print(f"  ✅  MySQL container: {container}")
print()

try:
    conn = pymysql.connect(
        host=db_host_for_setup,
        port=int(db_port),
        user="root",
        password=mysql_root_password,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    with conn.cursor() as cursor:

        # ── Create databases ──────────────────────────────────────────────────
        print("  ── Creating databases ──")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{backend_db_name}`")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{microservice_db_name}`")
        print(f"  ✅  Database '{backend_db_name}' ready")
        print(f"  ✅  Database '{microservice_db_name}' ready")
        print()

        # ── Backend user ──────────────────────────────────────────────────────
        print(f"  ── Setting up backend user: {backend_db_user} ──")
        cursor.execute(f"CREATE USER IF NOT EXISTS '{backend_db_user}'@'%' IDENTIFIED BY '{backend_db_password}'")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{backend_db_name}`.* TO '{backend_db_user}'@'%'")
        print(f"  ✅  User '{backend_db_user}' → '{backend_db_name}'")

        # ── Microservice user ─────────────────────────────────────────────────
        print(f"  ── Setting up microservice user: {microservice_db_user} ──")
        cursor.execute(f"CREATE USER IF NOT EXISTS '{microservice_db_user}'@'%' IDENTIFIED BY '{microservice_db_password}'")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{microservice_db_name}`.* TO '{microservice_db_user}'@'%'")
        print(f"  ✅  User '{microservice_db_user}' → '{microservice_db_name}'")

        cursor.execute("FLUSH PRIVILEGES")

    conn.commit()
    conn.close()

    # ── Apply schemas via docker exec ─────────────────────────────────────────
    print()
    print("  ── Applying schemas ──")

    run_sql_file_in_container(
        SCHEMA_DIR / "backend.sql",
        container,
        backend_db_user, backend_db_password,
        backend_db_name,
        "backend.sql",
    )

    run_sql_file_in_container(
        SCHEMA_DIR / "microservice.sql",
        container,
        microservice_db_user, microservice_db_password,
        microservice_db_name,
        "microservice.sql",
    )

    print()
    print("  ✅  Database setup complete")
    print()

except Exception as e:
    print(f"  ❌  Database setup failed: {e}")
    sys.exit(1)