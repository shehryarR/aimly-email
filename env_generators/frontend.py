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

# ── Paddle (appended by subscription implementation) ──────────
print()
print("  ── Paddle Billing ───────────────────────────────")
print("  ℹ️   Get client token from Paddle Dashboard →")
print("      Developer Tools → Authentication → Client-side tokens")
print("      Sandbox tokens start with 'test_'")
paddle_client_token = ask("Paddle Client-Side Token")

print()
print("  ℹ️   Enter the price_id for each plan (starts with pri_)")
print("      Find these in Paddle Dashboard → Catalog → Prices")
paddle_price_id_solo   = ask("Paddle Price ID — Solo   ($29/mo)")
paddle_price_id_studio = ask("Paddle Price ID — Studio ($79/mo)")
paddle_price_id_agency = ask("Paddle Price ID — Agency ($199/mo)")

paddle_sandbox_input = input("  Use Paddle Sandbox? (true/false) [true]: ").strip()
paddle_sandbox       = paddle_sandbox_input if paddle_sandbox_input else "true"
paddle_enabled_input = input("  Enable Paddle payments? (true/false) [false]: ").strip()
paddle_enabled       = paddle_enabled_input if paddle_enabled_input else "false"

write_section("Paddle Frontend", [
    "# ── Paddle Billing (Frontend) ────────────────────────",
    f"VITE_PADDLE_CLIENT_TOKEN={paddle_client_token}",
    f"VITE_PADDLE_PRICE_ID_SOLO={paddle_price_id_solo}",
    f"VITE_PADDLE_PRICE_ID_STUDIO={paddle_price_id_studio}",
    f"VITE_PADDLE_PRICE_ID_AGENCY={paddle_price_id_agency}",
    f"VITE_PADDLE_SANDBOX={paddle_sandbox}",
    f"VITE_PADDLE_ENABLED={paddle_enabled}",
])