"""
Email Microservice - End-to-End Tests
Run with: python -m pytest test_email_microservice.py -v
"""

import hmac
import hashlib
import os
import subprocess
import sys
import time
from urllib.parse import quote

import pytest
import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_URL = "http://localhost:8001"
MASTER_KEY = os.getenv("MICROSERVICE_API_KEY", "your-super-secure-microservice-key")


# -- Server lifecycle ---------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def start_server():
    """Start the FastAPI server before all tests and shut it down after."""
    os.makedirs("data", exist_ok=True)
    proc = subprocess.Popen(
        [sys.executable, "main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Wait until the server is accepting connections (max 10s)
    for _ in range(20):
        try:
            httpx.get(f"{BASE_URL}/", timeout=1)
            break
        except httpx.ConnectError:
            time.sleep(0.5)
    else:
        proc.terminate()
        raise RuntimeError("Server did not start in time")

    yield

    proc.terminate()
    proc.wait()


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_read_sig(api_key: str, backend_id: str, email_id: int) -> str:
    msg = f"{backend_id}{email_id}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


def make_optout_sig(api_key: str, backend_id: str, sender: str, receiver: str) -> str:
    msg = f"{backend_id}{sender}{receiver}".encode()
    return hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()


# ── Shared state (populated during tests) ────────────────────────────────────

state = {}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ADMIN — Backend Creation
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminCreateBackend:

    def test_create_backend_success(self):
        r = httpx.post(
            f"{BASE_URL}/admin/create-backend",
            json={"name": "Test Backend"},
            headers={"X-Api-Key": MASTER_KEY},
        )
        assert r.status_code == 200
        data = r.json()
        assert "backend_id" in data
        assert "api_key" in data
        assert data["api_key"].startswith("bk_")
        assert data["name"] == "Test Backend"

        # Store for subsequent tests
        state["backend_id"] = data["backend_id"]
        state["api_key"] = data["api_key"]

    def test_create_backend_invalid_master_key(self):
        r = httpx.post(
            f"{BASE_URL}/admin/create-backend",
            json={"name": "Should Fail"},
            headers={"X-Api-Key": "wrong-key"},
        )
        assert r.status_code == 401

    def test_create_backend_missing_master_key(self):
        r = httpx.post(
            f"{BASE_URL}/admin/create-backend",
            json={"name": "Should Fail"},
        )
        assert r.status_code == 422  # missing header


# ═══════════════════════════════════════════════════════════════════════════════
# 2. READ RECEIPT
# ═══════════════════════════════════════════════════════════════════════════════

class TestReadReceipt:

    # ── /register ─────────────────────────────────────────────────────────────

    def test_register_email_success(self):
        assert state.get("backend_id"), "Run TestAdminCreateBackend first"
        r = httpx.post(
            f"{BASE_URL}/read-receipt/register",
            json={"email_id": 1001},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert data["email_id"] == 1001

    def test_register_email_duplicate(self):
        r = httpx.post(
            f"{BASE_URL}/read-receipt/register",
            json={"email_id": 1001},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "already_exists"

    def test_register_email_invalid_api_key(self):
        r = httpx.post(
            f"{BASE_URL}/read-receipt/register",
            json={"email_id": 9999},
            headers={"X-Api-Key": "bk_fakefakefake"},
        )
        assert r.status_code == 401

    # ── /mark-read ────────────────────────────────────────────────────────────

    def test_mark_read_valid_sig(self):
        sig = make_read_sig(state["api_key"], state["backend_id"], 1001)
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{state['backend_id']}/1001",
            params={"sig": sig},
        )
        assert r.status_code == 200
        assert "confirmed" in r.text.lower()

    def test_mark_read_idempotent(self):
        """Hitting mark-read twice should still return 200, not error."""
        sig = make_read_sig(state["api_key"], state["backend_id"], 1001)
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{state['backend_id']}/1001",
            params={"sig": sig},
        )
        assert r.status_code == 200
        assert "already confirmed" in r.text.lower()

    def test_mark_read_invalid_sig(self):
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{state['backend_id']}/1001",
            params={"sig": "invalidsignature"},
        )
        assert r.status_code == 404

    def test_mark_read_missing_sig(self):
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{state['backend_id']}/1001",
        )
        assert r.status_code == 422  # sig is required query param

    def test_mark_read_invalid_backend(self):
        sig = make_read_sig(state["api_key"], "fake_backend", 1001)
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/fake_backend/1001",
            params={"sig": sig},
        )
        assert r.status_code == 404

    def test_mark_read_unregistered_email(self):
        """Valid sig but email_id never registered."""
        sig = make_read_sig(state["api_key"], state["backend_id"], 9999)
        r = httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{state['backend_id']}/9999",
            params={"sig": sig},
        )
        assert r.status_code == 404

    # ── /pending ──────────────────────────────────────────────────────────────

    def test_pending_returns_reads(self):
        r = httpx.get(
            f"{BASE_URL}/read-receipt/pending",
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert data["count"] >= 1
        read_ids = [x["email_id"] for x in data["reads"]]
        assert 1001 in read_ids

        # Store read row IDs for acknowledge test
        state["read_ids"] = [x["id"] for x in data["reads"]]

    def test_pending_invalid_api_key(self):
        r = httpx.get(
            f"{BASE_URL}/read-receipt/pending",
            headers={"X-Api-Key": "bk_fakefakefake"},
        )
        assert r.status_code == 401

    # ── /acknowledge ──────────────────────────────────────────────────────────

    def test_acknowledge_success(self):
        assert state.get("read_ids"), "Run test_pending_returns_reads first"
        r = httpx.post(
            f"{BASE_URL}/read-receipt/acknowledge",
            json={"read_ids": state["read_ids"]},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert data["processed_count"] == len(state["read_ids"])

    def test_acknowledge_clears_pending(self):
        """After acknowledging, pending should be empty."""
        r = httpx.get(
            f"{BASE_URL}/read-receipt/pending",
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_acknowledge_wrong_backend(self):
        """IDs from another backend should be rejected."""
        # Create a second backend
        r = httpx.post(
            f"{BASE_URL}/admin/create-backend",
            json={"name": "Second Backend"},
            headers={"X-Api-Key": MASTER_KEY},
        )
        second_api_key = r.json()["api_key"]

        # Register and read an email on second backend
        httpx.post(
            f"{BASE_URL}/read-receipt/register",
            json={"email_id": 2001},
            headers={"X-Api-Key": second_api_key},
        )
        second_backend_id = r.json()["backend_id"]
        sig = make_read_sig(second_api_key, second_backend_id, 2001)
        httpx.get(
            f"{BASE_URL}/read-receipt/mark-read/{second_backend_id}/2001",
            params={"sig": sig},
        )
        pending = httpx.get(
            f"{BASE_URL}/read-receipt/pending",
            headers={"X-Api-Key": second_api_key},
        ).json()
        second_read_ids = [x["id"] for x in pending["reads"]]

        # Try to acknowledge second backend's reads using first backend's key
        r = httpx.post(
            f"{BASE_URL}/read-receipt/acknowledge",
            json={"read_ids": second_read_ids},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 403

    def test_acknowledge_empty_list(self):
        r = httpx.post(
            f"{BASE_URL}/read-receipt/acknowledge",
            json={"read_ids": []},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 3. OPT-OUT
# ═══════════════════════════════════════════════════════════════════════════════

SENDER = "noreply@acme.com"
RECEIVER = "user@example.com"


class TestOptOut:

    # ── /check — before opting out ────────────────────────────────────────────

    def test_check_subscribed(self):
        assert state.get("api_key"), "Run TestAdminCreateBackend first"
        r = httpx.get(
            f"{BASE_URL}/optout/check",
            params={"sender_email": SENDER, "receiver_email": RECEIVER},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "subscribed"
        assert data["should_send"] is True

    def test_check_invalid_api_key(self):
        r = httpx.get(
            f"{BASE_URL}/optout/check",
            params={"sender_email": SENDER, "receiver_email": RECEIVER},
            headers={"X-Api-Key": "bk_fakefakefake"},
        )
        assert r.status_code == 401

    # ── /unsubscribe ──────────────────────────────────────────────────────────

    def test_unsubscribe_valid_sig(self):
        sig = make_optout_sig(state["api_key"], state["backend_id"], SENDER, RECEIVER)
        sender_enc = quote(SENDER, safe="")
        receiver_enc = quote(RECEIVER, safe="")
        r = httpx.get(
            f"{BASE_URL}/optout/unsubscribe/{state['backend_id']}/{sender_enc}/{receiver_enc}",
            params={"sig": sig},
        )
        assert r.status_code == 200
        assert "unsubscribed" in r.text.lower()

    def test_unsubscribe_idempotent(self):
        """Unsubscribing twice should still return 200."""
        sig = make_optout_sig(state["api_key"], state["backend_id"], SENDER, RECEIVER)
        sender_enc = quote(SENDER, safe="")
        receiver_enc = quote(RECEIVER, safe="")
        r = httpx.get(
            f"{BASE_URL}/optout/unsubscribe/{state['backend_id']}/{sender_enc}/{receiver_enc}",
            params={"sig": sig},
        )
        assert r.status_code == 200
        assert "already unsubscribed" in r.text.lower()

    def test_unsubscribe_invalid_sig(self):
        sender_enc = quote(SENDER, safe="")
        receiver_enc = quote(RECEIVER, safe="")
        r = httpx.get(
            f"{BASE_URL}/optout/unsubscribe/{state['backend_id']}/{sender_enc}/{receiver_enc}",
            params={"sig": "badsig"},
        )
        assert r.status_code == 404

    def test_unsubscribe_invalid_backend(self):
        sig = make_optout_sig(state["api_key"], "fake_backend", SENDER, RECEIVER)
        sender_enc = quote(SENDER, safe="")
        receiver_enc = quote(RECEIVER, safe="")
        r = httpx.get(
            f"{BASE_URL}/optout/unsubscribe/fake_backend/{sender_enc}/{receiver_enc}",
            params={"sig": sig},
        )
        assert r.status_code == 404

    def test_unsubscribe_sig_from_different_receiver(self):
        """Sig computed for a different receiver should be rejected."""
        sig = make_optout_sig(state["api_key"], state["backend_id"], SENDER, "other@example.com")
        sender_enc = quote(SENDER, safe="")
        receiver_enc = quote(RECEIVER, safe="")
        r = httpx.get(
            f"{BASE_URL}/optout/unsubscribe/{state['backend_id']}/{sender_enc}/{receiver_enc}",
            params={"sig": sig},
        )
        assert r.status_code == 404

    # ── /check — after opting out ─────────────────────────────────────────────

    def test_check_opted_out(self):
        r = httpx.get(
            f"{BASE_URL}/optout/check",
            params={"sender_email": SENDER, "receiver_email": RECEIVER},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "opted_out"
        assert data["should_send"] is False
        assert "opted_out_at" in data

    def test_check_different_sender_still_subscribed(self):
        """Opt-out is per sender+receiver pair — different sender is unaffected."""
        r = httpx.get(
            f"{BASE_URL}/optout/check",
            params={"sender_email": "other@acme.com", "receiver_email": RECEIVER},
            headers={"X-Api-Key": state["api_key"]},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "subscribed"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. HEALTH & META
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealthAndMeta:

    def test_health(self):
        r = httpx.get(f"{BASE_URL}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "active_backends" in data
        assert "unprocessed_reads" in data

    def test_root(self):
        r = httpx.get(f"{BASE_URL}/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "running"
        assert "read-receipt" in data["modules"]
        assert "optout" in data["modules"]