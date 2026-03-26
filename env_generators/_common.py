"""
_common.py — Shared helpers for all env generators
"""

import getpass
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
ENV_PATH = ROOT_DIR / ".env"

SECTION_MARKERS = {
    "mysql":        ("# ── MySQL", "# ──"),
    "microservice": ("# ── Microservice", "# ──"),
    "backend":      ("# ── Backend", "# ──"),
    "frontend":     ("# ── Frontend", "# ──"),
}


# ── Input helpers ─────────────────────────────────────────────────────────────

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


# ── .env read/write ───────────────────────────────────────────────────────────

def read_env() -> str:
    """Read existing .env or return empty string."""
    if ENV_PATH.exists():
        return ENV_PATH.read_text()
    return ""


def write_section(section_name: str, new_lines: list):
    """
    Replace or append a named section in the root .env.

    A section starts with its header comment (e.g. '# ── MySQL')
    and ends just before the next '# ──' header or end of file.
    If the section doesn't exist yet it is appended.
    """
    content = read_env()
    header = f"# ── {section_name}"

    new_block = "\n".join(new_lines) + "\n"

    if header in content:
        # Find start of this section
        start = content.index(header)

        # Find start of next section (next '# ──' after our header)
        next_section = content.find("\n# ──", start + 1)

        if next_section == -1:
            # This is the last section — replace to end of file
            content = content[:start] + new_block
        else:
            # Replace just this section, keep everything after
            content = content[:start] + new_block + "\n" + content[next_section + 1:]
    else:
        # Section doesn't exist — append
        if content and not content.endswith("\n"):
            content += "\n"
        if content:
            content += "\n"
        content += new_block

    ENV_PATH.write_text(content)
    print(f"  ✅  .env updated ({section_name} section)")