"""
env_generators/backend.py
Writes the Backend section of the root .env
No HTTP calls needed — MICROSERVICE_API_KEY is the single shared key.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, ask_secret, write_section, read_env

def read_env_var(key):
    for line in read_env().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None

print()
print("  ⚙️   BACKEND CONFIGURATION")
print("  " + "─" * 53)
print()

ms_port       = read_env_var("MICROSERVICE_PORT") or "8001"

app_port      = ask("Backend Port",                                        default="8000")
jwt_secret    = ask_secret("JWT Secret Key",                               default="123456789abcdef123456789abcdef12")
frontend_url  = ask("Frontend URL",                                        default="http://localhost:8501")
ms_base_url   = ask("Microservice Base URL (internal Docker)",             default=f"http://email-microservice:{ms_port}")
ms_public_url = ask("Microservice Public URL (browser-accessible)",        default=f"http://localhost:{ms_port}")
internal_key  = ask_secret("Internal API Key",                             default="some-strong-random-secret")
cookie_secret = ask_secret("Cookie Secret",                                default="f4e8373350b504674fb13e0ec97055f0e6559fdd9b61eacfe449d2ad7802188e")
env           = ask("ENV",                                                 default="development")

print()
print("  ── SMTP ─────────────────────────────────────────")
smtp_server = ask("SMTP Server",                default="smtp.gmail.com")
smtp_port   = ask("SMTP Port",                  default="587")
smtp_tls    = ask("SMTP Use TLS? (true/false)", default="true")
smtp_user   = ask("SMTP Email")
smtp_pass   = ask_secret("SMTP Password")

print()
print("  ── reCAPTCHA v3 ─────────────────────────────────")
print("  ℹ️   Get keys from https://www.google.com/recaptcha/admin")
recaptcha_secret = ask_secret("reCAPTCHA Secret Key (backend/private)")

print()
print("  ── Google OAuth ─────────────────────────────────")
print("  ℹ️   Get credentials from https://console.cloud.google.com")
google_client_id     = ask("Google Client ID")
google_client_secret = ask_secret("Google Client Secret")
google_redirect_uri  = ask("Google Redirect URI", default="http://localhost:8501/auth")

write_section("Backend", [
    "# ── Backend ──────────────────────────────────────────",
    f"APP_PORT={app_port}",
    f"JWT_SECRET_KEY={jwt_secret}",
    f"FRONTEND_URL={frontend_url}",
    f"MICROSERVICE_BASE_URL={ms_base_url}",
    f"MICROSERVICE_PUBLIC_URL={ms_public_url}",
    f"EMAIL_SMTP_SERVER={smtp_server}",
    f"EMAIL_SMTP_PORT={smtp_port}",
    f"EMAIL_USE_TLS={smtp_tls}",
    f"EMAIL_HOST_USER={smtp_user}",
    f"EMAIL_HOST_PASSWORD={smtp_pass}",
    f"RECAPTCHA_SECRET_KEY={recaptcha_secret}",
    f"ATTACHMENT_STORAGE_PATH=./data/uploads/attachments",
    f"INTERNAL_API_KEY={internal_key}",
    f"COOKIE_SECRET={cookie_secret}",
    f"ENV={env}",
    f"GOOGLE_CLIENT_ID={google_client_id}",
    f"GOOGLE_CLIENT_SECRET={google_client_secret}",
    f"GOOGLE_REDIRECT_URI={google_redirect_uri}",
])

print()

# ── Paddle (appended by subscription implementation) ──────────
print()
print("  ── Paddle Billing ───────────────────────────────")
print("  ℹ️   Get keys from https://sandbox-vendors.paddle.com (sandbox)")
print("      or https://vendors.paddle.com (production)")
paddle_api_key       = ask_secret("Paddle API Key")
paddle_webhook_secret = ask_secret("Paddle Webhook Secret")
paddle_price_id      = ask("Paddle Price ID (starts with pri_)")
paddle_sandbox_input = input("  Use Paddle Sandbox? (true/false) [true]: ").strip()
paddle_sandbox       = paddle_sandbox_input if paddle_sandbox_input else "true"
paddle_enabled_input = input("  Enable Paddle payments? (true/false) [false]: ").strip()
paddle_enabled       = paddle_enabled_input if paddle_enabled_input else "false"

write_section("Paddle", [
    "# ── Paddle Billing ───────────────────────────────────",
    f"PADDLE_API_KEY={paddle_api_key}",
    f"PADDLE_WEBHOOK_SECRET={paddle_webhook_secret}",
    f"PADDLE_PRICE_ID={paddle_price_id}",
    f"PADDLE_SANDBOX={paddle_sandbox}",
    f"PADDLE_ENABLED={paddle_enabled}",
])