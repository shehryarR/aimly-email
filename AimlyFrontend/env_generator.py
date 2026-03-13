"""
env_generator.py — AimlyFrontend
Writes .env from interactive prompts.
Usage: python3 env_generator.py
"""

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


print()
print("  ⚙️   FRONTEND CONFIGURATION  →  .env")
print("  " + "─" * 53)
print()

vite_url  = ask("Backend URL",  default="http://localhost:8000")
print()
print("  ℹ️   Set Backend Port ONLY if your URL has no port.")
print("      e.g. URL=https://myapp.com        → set port 8000")
print("      e.g. URL=https://myapp.com:8000   → leave blank")
vite_port = input("  Backend Port (leave blank to skip) : ").strip()

lines = [f"VITE_BACKEND_URL={vite_url}"]
if vite_port:
    lines.append(f"VITE_BACKEND_PORT={vite_port}")

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(out_path, "w") as f:
    f.write("\n".join(lines) + "\n")

print()
print("  ✅  .env written")
print()