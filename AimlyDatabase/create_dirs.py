"""
AimlyDatabase/create_dirs.py
Creates all shared data directories required by the stack.
Run once at the start of `make setup`, before any containers start.
"""

import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent

DIRS = [
    ROOT_DIR / "data" / "mysql",
    ROOT_DIR / "data" / "uploads" / "attachments",
]

print()
print("  📁  CREATING SHARED DATA DIRECTORIES")
print("  " + "─" * 53)
print()

all_ok = True
for d in DIRS:
    try:
        d.mkdir(parents=True, exist_ok=True)
        print(f"  ✅  {d.relative_to(ROOT_DIR)}")
    except Exception as e:
        print(f"  ❌  Failed to create {d.relative_to(ROOT_DIR)}: {e}")
        all_ok = False

print()

if not all_ok:
    sys.exit(1)

print("  ✅  All directories ready")
print()