"""
env_generators/setup_db.py
Connects to MySQL as root and sets up:
- backend user with access only to aimly_backend
- microservice user with access only to aimly_microservice

Runs during make setup after MySQL is healthy.
"""

import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))
from _common import read_env

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("  ❌  pymysql not installed. Run: pip install pymysql cryptography")
    sys.exit(1)


def read_env_var(key):
    for line in read_env().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None


def wait_for_mysql(host, port, root_password, max_retries=10):
    """Wait until MySQL is reachable as root."""
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


print()
print("  ⚙️   DATABASE USER SETUP")
print("  " + "─" * 53)
print()

# setup_db.py always runs on the host machine, so always connect via localhost
# DB_HOST=mysql is only for containers — not used here
db_host_for_setup    = "127.0.0.1"
db_port              = read_env_var("DB_PORT") or "3306"
mysql_root_password  = read_env_var("MYSQL_ROOT_PASSWORD") or ""
backend_db_name      = read_env_var("BACKEND_DB_NAME") or "aimly_backend"
microservice_db_name = read_env_var("MICROSERVICE_DB_NAME") or "aimly_microservice"
backend_db_user      = read_env_var("BACKEND_DB_USER") or ""
backend_db_password  = read_env_var("BACKEND_DB_PASSWORD") or ""
microservice_db_user = read_env_var("MICROSERVICE_DB_USER") or ""
microservice_db_password = read_env_var("MICROSERVICE_DB_PASSWORD") or ""

# Validate
missing = []
for name, val in [
    ("MYSQL_ROOT_PASSWORD", mysql_root_password),
    ("BACKEND_DB_USER", backend_db_user),
    ("BACKEND_DB_PASSWORD", backend_db_password),
    ("MICROSERVICE_DB_USER", microservice_db_user),
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
print()

# Connect as root and set up users
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
        print(f"  ── Creating databases ──")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{backend_db_name}`")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{microservice_db_name}`")
        print(f"  ✅  Database '{backend_db_name}' ready")
        print(f"  ✅  Database '{microservice_db_name}' ready")
        print()

        # ── Backend user ──────────────────────────────────────────────────────
        print(f"  ── Setting up backend user: {backend_db_user} ──")
        cursor.execute(f"CREATE USER IF NOT EXISTS '{backend_db_user}'@'%' IDENTIFIED BY '{backend_db_password}'")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{backend_db_name}`.* TO '{backend_db_user}'@'%'")
        print(f"  ✅  User '{backend_db_user}' created with access to '{backend_db_name}'")

        # ── Microservice user ─────────────────────────────────────────────────
        print(f"  ── Setting up microservice user: {microservice_db_user} ──")
        cursor.execute(f"CREATE USER IF NOT EXISTS '{microservice_db_user}'@'%' IDENTIFIED BY '{microservice_db_password}'")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{microservice_db_name}`.* TO '{microservice_db_user}'@'%'")
        print(f"  ✅  User '{microservice_db_user}' created with access to '{microservice_db_name}'")

        cursor.execute("FLUSH PRIVILEGES")

    conn.commit()
    conn.close()

    print()
    print("  ✅  Database users configured successfully")
    print()

except Exception as e:
    print(f"  ❌  Failed to set up database users: {e}")
    sys.exit(1)