# AimlyOpenClaw/server.py

import asyncio
import json
import os
import re
import shutil
import subprocess
import uuid
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="OpenClaw Proxy", version="1.0.0")

OPENCLAW_CONFIG = os.path.expanduser("~/.openclaw/openclaw.json")
AUTH_PROFILES   = os.path.expanduser("~/.openclaw/agents/main/agent/auth-profiles.json")
AGENT_ID        = "main"

_lock = asyncio.Lock()

# Server access key — set via environment variable SERVER_API_KEY
SERVER_API_KEY = os.environ.get("SERVER_API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Gemini-specific auth failure phrases
INVALID_KEY_PHRASES = [
    "no api key found for provider",
    "api key not valid",
    "api_key_invalid",
    "api key is invalid",
    "authentication failed",
    "invalid authentication",
    "candidate_failed",
    "failovererror",
]

MESSAGE_WRAPPER = (
    "Important instructions: If any tool (such as web search) is unavailable or returns "
    "an authentication error, do NOT mention it — just respond as helpfully as possible "
    "using your own knowledge. Never say you cannot search or that a tool is missing. "
    "Simply answer the question directly.\n\nUser message: {message}"
)

ANSI_ESCAPE = re.compile(r'\x1b\[[0-9;]*m')


class QueryRequest(BaseModel):
    message:    str
    gemini_key: str
    tavily_key: str


class QueryResponse(BaseModel):
    text:        str
    duration_ms: Optional[int] = None
    model:       Optional[str] = None


def _verify_server_key(key: Optional[str] = Security(api_key_header)):
    if not SERVER_API_KEY:
        raise HTTPException(status_code=500, detail="Server API key not configured")
    if key != SERVER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid server API key")
    return key


def _read_json(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def _write_json(path: str, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())


def _set_gemini_key(key: str):
    profiles = _read_json(AUTH_PROFILES)
    profiles["profiles"]["google:default"]["key"] = key
    _write_json(AUTH_PROFILES, profiles)


def _set_tavily_key(key: str):
    config = _read_json(OPENCLAW_CONFIG)
    config["plugins"]["entries"]["tavily"]["config"]["webSearch"]["apiKey"] = key
    _write_json(OPENCLAW_CONFIG, config)


def _strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)


def _extract_openclaw_json(raw: str) -> dict:
    pos = 0
    while True:
        start = raw.find("{", pos)
        if start == -1:
            break
        for end in range(len(raw), start, -1):
            try:
                candidate = json.loads(raw[start:end])
                if "payloads" in candidate or "result" in candidate:
                    return candidate
            except json.JSONDecodeError:
                continue
        pos = start + 1
    raise ValueError("No openclaw JSON response found in output")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(body: QueryRequest, key: str = Security(_verify_server_key)):
    session_id = str(uuid.uuid4())

    wrapped_message = MESSAGE_WRAPPER.format(message=body.message)

    async with _lock:
        try:
            _set_gemini_key(body.gemini_key)
            _set_tavily_key(body.tavily_key)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to set keys: {e}")

        try:
            result = subprocess.run(
                [
                    "openclaw", "agent",
                    "--agent", AGENT_ID,
                    "--session-id", session_id,
                    "--local",
                    "--message", wrapped_message,
                    "--json"
                ],
                capture_output=True,
                text=True,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to run openclaw: {e}")
        finally:
            try:
                _set_gemini_key("")
                _set_tavily_key("")
            except Exception:
                pass
            try:
                session_dir = os.path.expanduser(f"~/.openclaw/agents/main/sessions/{session_id}")
                if os.path.exists(session_dir):
                    shutil.rmtree(session_dir)
            except Exception:
                pass

    raw = _strip_ansi(result.stdout.strip() or result.stderr.strip())
    if not raw:
        raise HTTPException(status_code=500, detail="Empty response from openclaw")

    raw_lower = raw.lower()
    if any(phrase in raw_lower for phrase in INVALID_KEY_PHRASES):
        raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        data = _extract_openclaw_json(raw)
        try:
            payloads    = data["result"]["payloads"]
            duration_ms = data["result"]["meta"].get("durationMs")
            model       = data["result"]["meta"]["agentMeta"].get("model")
        except KeyError:
            payloads    = data["payloads"]
            duration_ms = data["meta"].get("durationMs")
            model       = data["meta"]["agentMeta"].get("model")

        text = payloads[0]["text"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse response: {e}\nRaw: {raw[:500]}")

    return QueryResponse(text=text, duration_ms=duration_ms, model=model)