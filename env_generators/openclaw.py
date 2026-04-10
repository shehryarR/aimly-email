# env_generators/openclaw.py

"""
Writes the OpenClaw section of the root .env
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from _common import ask, ask_secret, write_section

print()
print("  ⚙️   OPENCLAW CONFIGURATION")
print("  " + "─" * 53)
print()

openclaw_server_key = ask_secret("OpenClaw Server API Key", default="your-super-secure-openclaw-key")

write_section("OpenClaw", [
    "# ── OpenClaw ──────────────────────────────────────────",
    f"OPENCLAW_SERVER_KEY={openclaw_server_key}",
])

print()