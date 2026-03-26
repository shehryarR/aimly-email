"""
env_generators/mysql.py
Writes the MySQL section of the root .env
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, ask_secret, write_section

print()
print("  ⚙️   MYSQL CONFIGURATION")
print("  " + "─" * 53)
print()

print("  ── Root ─────────────────────────────────────────")
mysql_root_password  = ask_secret("MySQL Root Password",              default="changeme_root")

print()
print("  ── Backend DB User ──────────────────────────────")
backend_db_user      = ask("Backend DB Username",                     default="aimly_backend")
backend_db_password  = ask_secret("Backend DB Password",              default="changeme_backend")

print()
print("  ── Microservice DB User ─────────────────────────")
microservice_db_user     = ask("Microservice DB Username",            default="aimly_microservice")
microservice_db_password = ask_secret("Microservice DB Password",     default="changeme_microservice")

print()
print("  ── Connection ───────────────────────────────────")
db_host              = ask("MySQL Host",                              default="mysql")
db_port              = ask("MySQL Port",                              default="3306")
backend_db_name      = ask("Backend Database Name",                   default="aimly_backend")
microservice_db_name = ask("Microservice Database Name",              default="aimly_microservice")

write_section("MySQL", [
    "# ── MySQL ───────────────────────────────────────────",
    f"MYSQL_ROOT_PASSWORD={mysql_root_password}",
    f"BACKEND_DB_USER={backend_db_user}",
    f"BACKEND_DB_PASSWORD={backend_db_password}",
    f"MICROSERVICE_DB_USER={microservice_db_user}",
    f"MICROSERVICE_DB_PASSWORD={microservice_db_password}",
    f"DB_HOST={db_host}",
    f"DB_PORT={db_port}",
    f"BACKEND_DB_NAME={backend_db_name}",
    f"MICROSERVICE_DB_NAME={microservice_db_name}",
])

print()