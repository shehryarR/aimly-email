"""
env_generators/microservice.py
Writes the Microservice section of the root .env
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, ask_secret, write_section

print()
print("  ⚙️   MICROSERVICE CONFIGURATION")
print("  " + "─" * 53)
print()

ms_api_key = ask_secret("Microservice API Key", default="your-super-secure-microservice-key")
ms_port    = ask("Microservice Port",           default="8001")

write_section("Microservice", [
    "# ── Microservice ─────────────────────────────────────",
    f"MICROSERVICE_API_KEY={ms_api_key}",
    f"MICROSERVICE_PORT={ms_port}",
])

print()