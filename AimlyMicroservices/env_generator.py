"""
env_generator.py — AimlyMicroservices
Writes .env from interactive prompts.
Usage: python3 env_generator.py
"""

import getpass
import os


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


def ask_secret(prompt):
    display = f"  {prompt} : "
    while True:
        value = getpass.getpass(display)
        if value:
            return value
        print("  ⚠️   Required. Please enter a value.")


print()
print("  ⚙️   MICROSERVICES CONFIGURATION  →  .env")
print("  " + "─" * 53)
print()

svc_api_key = ask_secret("Microservice API Key")
svc_db      = ask("DB Path",           default="./data/email_microservice.db")
svc_port    = ask("Microservice Port", default="8001")

lines = [
    f"MICROSERVICE_API_KEY={svc_api_key}",
    f"MICROSERVICE_DB_PATH={svc_db}",
    f"MICROSERVICE_PORT={svc_port}",
]

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(out_path, "w") as f:
    f.write("\n".join(lines) + "\n")

print()
print("  ✅  .env written")
print()