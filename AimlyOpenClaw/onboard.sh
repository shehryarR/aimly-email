#!/bin/bash
# AimlyOpenClaw/onboard.sh
set -e

echo "Writing OpenClaw config..."

mkdir -p /root/.openclaw/workspace
mkdir -p /root/.openclaw/agents/main/sessions
mkdir -p /root/.openclaw/agents/main/agent

GATEWAY_TOKEN=$(openssl rand -hex 24)

cat > /root/.openclaw/agents/main/agent/auth-profiles.json << AUTHEOF
{
  "version": 1,
  "profiles": {
    "google:default": {
      "type": "api_key",
      "provider": "google",
      "key": ""
    }
  }
}
AUTHEOF

cat > /root/.openclaw/openclaw.json << CONFIGEOF
{
  "agents": {
    "defaults": {
      "workspace": "/root/.openclaw/workspace",
      "model": {
        "primary": "google/gemini-3.1-pro-preview-customtools"
      },
      "models": {
        "google/gemini-3.1-pro-preview": {},
        "google/gemini-3.1-pro-preview-customtools": {}
      }
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "${GATEWAY_TOKEN}"
    },
    "port": 18789,
    "bind": "loopback",
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "controlUi": {
      "allowInsecureAuth": true
    },
    "nodes": {
      "denyCommands": [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send",
        "sms.search"
      ]
    }
  },
  "session": {
    "dmScope": "per-channel-peer"
  },
  "tools": {
    "profile": "coding",
    "web": {
      "search": {
        "provider": "tavily",
        "enabled": true
      }
    }
  },
  "auth": {
    "profiles": {
      "google:default": {
        "provider": "google",
        "mode": "api_key"
      }
    }
  },
  "plugins": {
    "entries": {
      "tavily": {
        "enabled": true,
        "config": {
          "webSearch": {
            "apiKey": ""
          }
        }
      }
    }
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "boot-md": {
          "enabled": true
        },
        "command-logger": {
          "enabled": true
        },
        "session-memory": {
          "enabled": true
        }
      }
    }
  },
  "wizard": {
    "lastRunAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "lastRunVersion": "2026.4.9",
    "lastRunCommand": "onboard",
    "lastRunMode": "local"
  },
  "meta": {
    "lastTouchedVersion": "2026.4.9",
    "lastTouchedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  }
}
CONFIGEOF

echo "Config written."
echo "Gateway token: ${GATEWAY_TOKEN}"
echo "Skipping gateway (using --local mode)..."

echo "Starting proxy server on port 8000..."
cd /app && uvicorn server:app --host 0.0.0.0 --port 8000