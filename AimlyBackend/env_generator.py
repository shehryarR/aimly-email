"""
env_generator.py — AimlyBackend
Writes env.json from interactive prompts.
Usage: python3 env_generator.py
"""

import json
import getpass
import os
import urllib.request
import urllib.error


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def ask(prompt, default=None):
    display = f"  {prompt}"
    if default is not None:
        display += f" (default: {default})"
    display += " : "
    while True:
        value = input(display).strip()
        if value:
            return value
        elif default is not None:
            return default
        else:
            print("  ⚠️   Required. Please enter a value.")


def ask_secret(prompt, default=None):
    display = f"  {prompt}"
    if default is not None:
        display += f" (default: {default})"
    display += " : "
    while True:
        value = getpass.getpass(display)
        if value:
            return value
        elif default is not None:
            return default
        else:
            print("  ⚠️   Required. Please enter a value.")


def ask_yes_no(prompt, default="y"):
    display = f"  {prompt} [y/n, default: {default}] : "
    while True:
        value = input(display).strip().lower()
        if not value:
            return default == "y"
        if value in ("y", "yes"):
            return True
        if value in ("n", "no"):
            return False
        print("  ⚠️   Please enter y or n.")


def read_microservice_env():
    """Read MICROSERVICE_API_KEY and MICROSERVICE_PORT from AimlyMicroservices/.env"""
    env_path = os.path.join(SCRIPT_DIR, "../AimlyMicroservices/.env")
    env_path = os.path.normpath(env_path)
    values = {}
    if not os.path.exists(env_path):
        return values
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                values[key.strip()] = val.strip()
    return values


def generate_backend_credentials(master_key, port):
    """Call POST /admin/create-backend and return (backend_id, api_key)"""
    url = f"http://localhost:{port}/admin/create-backend"
    payload = json.dumps({"name": "AimlyBackend"}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Api-Key": master_key
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data["backend_id"], data["api_key"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Could not connect to microservice: {e.reason}")


# ─────────────────────────────────────────────────────────────
print()
print("  ⚙️   BACKEND CONFIGURATION  →  env.json")
print("  " + "─" * 53)
print()

jwt_secret   = ask("JWT Secret Key",        default="123456789abcdef123456789abcdef")
frontend_url = ask("Frontend URL",          default="http://localhost:8501")
ms_base_url  = ask("Microservice Base URL", default="http://localhost:8001")

# ── MICROSERVICE_BACKEND_ID + MICROSERVICE_API_KEY ────────────
print()
print("  ── Microservice Credentials ─────────────────────")
auto = ask_yes_no("Auto-generate from running microservice? (or enter manually)")

if auto:
    ms_env = read_microservice_env()
    master_key = ms_env.get("MICROSERVICE_API_KEY", "")
    port       = ms_env.get("MICROSERVICE_PORT", "8001")

    if not master_key:
        print("  ⚠️   Could not read MICROSERVICE_API_KEY from AimlyMicroservices/.env")
        print("       Falling back to manual entry.")
        auto = False
    else:
        print(f"  ℹ️   Using master key from AimlyMicroservices/.env, port {port}")
        print("  ⏳  Calling POST /admin/create-backend ...")
        try:
            ms_backend_id, ms_api_key = generate_backend_credentials(master_key, port)
            print(f"  ✅  Backend ID : {ms_backend_id}")
            print(f"  ✅  API Key    : {ms_api_key}")
        except RuntimeError as e:
            print(f"  ❌  Failed: {e}")
            print("       Falling back to manual entry.")
            auto = False

if not auto:
    ms_backend_id = ask("Microservice Backend ID")
    ms_api_key    = ask_secret("Microservice API Key")

# ── SMTP ──────────────────────────────────────────────────────
print()
print("  ── SMTP Configuration (required) ───────────────")
smtp_server  = ask("SMTP Server",      default="smtp.gmail.com")
smtp_port    = ask("SMTP Port",        default="587")
smtp_tls     = ask("SMTP Use TLS?     (true/false)", default="true")
smtp_user    = ask("SMTP Email")
smtp_pass    = ask_secret("SMTP Password")

# ── reCAPTCHA ─────────────────────────────────────────────────
print()
print("  ── reCAPTCHA v3 ─────────────────────────────────")
print("  ℹ️   Get your secret key from https://www.google.com/recaptcha/admin")
print("      This is the PRIVATE key — never share it or put it in the frontend.")
recaptcha_secret = ask_secret("reCAPTCHA Secret Key")

# ── Advanced ──────────────────────────────────────────────────
print()
print("  ── Advanced ─────────────────────────────────────")
internal_key  = ask("Internal API Key", default="some-strong-random-secret")
cookie_secret = ask("Cookie Secret",    default="f4e8373350b504674fb13e0ec97055f0e6559fdd9b61eacfe449d2ad7802188e")
env           = ask("ENV",              default="development")

# ── Write env.json ────────────────────────────────────────────
data = {
    "APP_PORT": 8000,
    "JWT_SECRET_KEY": jwt_secret,
    "FRONTEND_URL": frontend_url,
    "MICROSERVICE_BASE_URL": ms_base_url,
    "MICROSERVICE_BACKEND_ID": ms_backend_id,
    "MICROSERVICE_API_KEY": ms_api_key,
    "EMAIL_SMTP_SERVER": smtp_server,
    "EMAIL_SMTP_PORT": int(smtp_port),
    "EMAIL_USE_TLS": smtp_tls.lower() != "false",
    "EMAIL_HOST_USER": smtp_user,
    "EMAIL_HOST_PASSWORD": smtp_pass,
    "RECAPTCHA_SECRET_KEY": recaptcha_secret,
    "ATTACHMENT_STORAGE_PATH": "./data/uploads/attachments",
    "INTERNAL_API_KEY": internal_key,
    "COOKIE_SECRET": cookie_secret,
    "ENV": env
}

out_path = os.path.join(SCRIPT_DIR, "env.json")
with open(out_path, "w") as f:
    json.dump(data, f, indent=4)

print()
print("  ✅  env.json written")
print()