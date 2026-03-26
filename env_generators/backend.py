"""
env_generators/backend.py
Writes the Backend section of the root .env
Handles auto-generation of microservice credentials
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error
import subprocess
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, ask_secret, write_section, read_env, ENV_PATH

# ── Read already-set microservice vars from .env ──────────────────────────────

def read_env_var(key):
    """Read a specific var from the current .env."""
    for line in read_env().splitlines():
        line = line.strip()
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    return None


def generate_backend_credentials(master_key, port):
    """Call POST /admin/create-backend and return (backend_id, api_key)."""
    url = f"http://localhost:{port}/admin/create-backend"
    payload = json.dumps({"name": "AimlyBackend"}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "X-Api-Key": master_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data["backend_id"], data["api_key"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not connect to microservice: {e.reason}")


# ── Prompts ───────────────────────────────────────────────────────────────────

print()
print("  ⚙️   BACKEND CONFIGURATION")
print("  " + "─" * 53)
print()

app_port      = ask("Backend Port",          default="8000")
jwt_secret    = ask("JWT Secret Key",        default="123456789abcdef123456789abcdef")
ms_port       = read_env_var("MICROSERVICE_PORT") or "8001"
frontend_url  = ask("Frontend URL",          default="http://localhost:8501")
ms_base_url   = ask("Microservice Base URL", default=f"http://email-microservice:{ms_port}")
internal_key  = ask("Internal API Key",      default="some-strong-random-secret")
cookie_secret = ask("Cookie Secret",         default="f4e8373350b504674fb13e0ec97055f0e6559fdd9b61eacfe449d2ad7802188e")
env           = ask("ENV",                   default="development")

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

# ── Auto-generate microservice credentials ────────────────────────────────────

print()
print("  ── Microservice Credentials ─────────────────────")

ms_backend_id  = None
ms_backend_key = None

ms_api_key = read_env_var("MICROSERVICE_API_KEY")
if not ms_api_key:
    print("  ❌  MICROSERVICE_API_KEY not found in .env")
    print("  ⚠️   Please run env_generators/microservice.py first.")
    exit(1)

print("  ⏳  Calling POST /admin/create-backend ...")
max_retries = 5
for attempt in range(1, max_retries + 1):
    try:
        ms_backend_id, ms_backend_key = generate_backend_credentials(ms_api_key, ms_port)
        print(f"  ✅  Backend ID : {ms_backend_id}")
        print(f"  ✅  API Key    : {ms_backend_key}")
        break
    except RuntimeError as e:
        print(f"  ⚠️   Attempt {attempt}/{max_retries} failed: {e}")
        if attempt < max_retries:
            print(f"  ⏳  Retrying in 5s...")
            time.sleep(5)
        else:
            print("  ❌  All attempts failed. Is the microservice running?")
            exit(1)

# ── Write section ─────────────────────────────────────────────────────────────

write_section("Backend", [
    "# ── Backend ──────────────────────────────────────────",
    f"APP_PORT={app_port}",
    f"JWT_SECRET_KEY={jwt_secret}",
    f"FRONTEND_URL={frontend_url}",
    f"MICROSERVICE_BASE_URL={ms_base_url}",
    f"MICROSERVICE_BACKEND_ID={ms_backend_id}",
    f"MICROSERVICE_API_KEY={ms_backend_key}",
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