"""
env_generators/frontend.py
Writes the Frontend section of the root .env
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, read_env, write_section

def read_env_var(key):
    for line in read_env().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None

print()
print("  ⚙️   FRONTEND CONFIGURATION")
print("  " + "─" * 53)
print()

# Read backend port from already-written .env as default
app_port = read_env_var("APP_PORT") or "8000"

vite_url = ask("Backend URL", default=f"http://localhost:{app_port}")
print()
print("  ℹ️   Set Backend Port ONLY if your URL has no port.")
print("      e.g. URL=https://myapp.com        → set port")
print("      e.g. URL=https://myapp.com:8000   → leave blank")
vite_port = input("  Backend Port (leave blank to skip) : ").strip()

print()
print("  ── reCAPTCHA v3 ─────────────────────────────────")
print("  ℹ️   Get site key from https://www.google.com/recaptcha/admin")
recaptcha_site_key = ask("reCAPTCHA Site Key (frontend/public)")

lines = [
    "# ── Frontend ─────────────────────────────────────────",
    f"VITE_BACKEND_URL={vite_url}",
    f"VITE_RECAPTCHA_SITE_KEY={recaptcha_site_key}",
]

if vite_port:
    lines.append(f"VITE_BACKEND_PORT={vite_port}")

write_section("Frontend", lines)

print()