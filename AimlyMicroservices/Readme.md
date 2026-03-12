# Email Microservice

A single FastAPI microservice combining two services:

- **Read Receipt** — track when recipients open an email
- **Opt-Out** — one-click unsubscribe with sender/receiver suppression list

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set MICROSERVICE_API_KEY

# 3. Create data directory
mkdir -p data

# 4. Run
python main.py
```

**Docker:**
```bash
make docker-build
make docker-up
make docker-logs
```

---

## Testing

Tests start and stop the server automatically — no separate terminal needed.

```bash
python -m pytest test_email_microservice.py -v
```

The test suite covers the full flow: backend creation, read receipt (register → mark-read → pending → acknowledge), opt-out (unsubscribe → check), and health endpoints. It also verifies that invalid/missing signatures, wrong API keys, and cross-backend access are all rejected correctly.

---

## Authentication

Two levels of API keys:

| Key | Used for | How to pass |
|-----|----------|-------------|
| Master key (`MICROSERVICE_API_KEY`) | Admin routes — creating backends | `X-Api-Key: <master-key>` header |
| Backend key (`bk_...`) | All service routes — adding emails, fetching reads/optouts | `X-Api-Key: <backend-key>` header |

---

## Section 1 — Read Receipt

Track when a recipient opens an email. Embed a signed tracking pixel in your outgoing email. Poll `/read-receipt/pending` to sync open events back to your system.

**Flow:**
1. Register the email ID before sending → `/read-receipt/register`
2. Generate a signed URL and embed it as a pixel in your email → `/read-receipt/mark-read/{backend_id}/{email_id}?sig={sig}`
3. Poll for new opens → `/read-receipt/pending`
4. Acknowledge synced events → `/read-receipt/acknowledge`

**Generating the signed URL (in your sending backend):**
```python
import hmac, hashlib

def make_track_url(backend_id, api_key, email_id):
    msg = f"{backend_id}{email_id}".encode()
    sig = hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()
    return f"https://your-domain.com/read-receipt/mark-read/{backend_id}/{email_id}?sig={sig}"
```

---

### `POST /admin/create-backend`

Create a new tenant backend and receive its API key. Use the master key.

```bash
curl -X POST http://localhost:8001/admin/create-backend \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your-master-key" \
  -d '{"name": "My App"}'
```

**Response:**
```json
{
  "backend_id": "backend_abc123",
  "api_key": "bk_xxxxxxxxxxxxxxxxxxx",
  "name": "My App",
  "created_at": "2024-01-15T10:00:00"
}
```

---

### `POST /read-receipt/register`

Register an email ID for tracking. Call this when you send an email.

```bash
curl -X POST http://localhost:8001/read-receipt/register \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: bk_xxxxxxxxxxxxxxxxxxx" \
  -d '{"email_id": 1042}'
```

**Response:**
```json
{
  "status": "success",
  "backend_id": "backend_abc123",
  "email_id": 1042,
  "message": "Email registered successfully"
}
```

---

### `GET /read-receipt/mark-read/{backend_id}/{email_id}?sig={sig}`

Tracking pixel endpoint embedded in outgoing emails. When the recipient opens the email and their client loads the pixel, it records the open timestamp. The `sig` query param is required — unsigned or tampered URLs return 404.

```bash
curl "http://localhost:8001/read-receipt/mark-read/backend_abc123/1042?sig=YOUR_COMPUTED_SIG"
```

> Embed as a 1×1 pixel image in your email template:
> ```html
> <img src="https://your-domain.com/read-receipt/mark-read/backend_abc123/1042?sig=YOUR_SIG" width="1" height="1" />
> ```

---

### `GET /read-receipt/pending`

Fetch all open events that haven't been synced to your backend yet. Poll this endpoint periodically.

```bash
curl http://localhost:8001/read-receipt/pending \
  -H "X-Api-Key: bk_xxxxxxxxxxxxxxxxxxx"
```

**Response:**
```json
{
  "status": "success",
  "backend_id": "backend_abc123",
  "count": 2,
  "reads": [
    {
      "id": 1,
      "email_id": 1042,
      "read_at": "2024-01-15T11:23:45",
      "created_at": "2024-01-15T10:00:00"
    },
    {
      "id": 2,
      "email_id": 1043,
      "read_at": "2024-01-15T12:01:00",
      "created_at": "2024-01-15T10:05:00"
    }
  ]
}
```

---

### `POST /read-receipt/acknowledge`

After syncing read events to your system, mark them as processed so they won't appear in the next fetch.

```bash
curl -X POST http://localhost:8001/read-receipt/acknowledge \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: bk_xxxxxxxxxxxxxxxxxxx" \
  -d '{"read_ids": [1, 2]}'
```

**Response:**
```json
{
  "status": "success",
  "backend_id": "backend_abc123",
  "processed_count": 2,
  "message": "Successfully marked 2 reads as processed"
}
```

---

## Section 2 — Opt-Out / Unsubscribe

Let recipients unsubscribe from a specific sender. Each entry is uniquely identified by `backend_id + sender_email + receiver_email`. Unsubscribe URLs are secured with HMAC-SHA256 signatures using the backend's own API key — forged URLs are rejected.

**Flow:**
1. Your backend generates a signed unsubscribe URL and embeds it in the email
2. Recipient clicks → signature verified → entry recorded
3. Before sending any email, call `/optout/check` with your API key

**Generating the signed URL (in your sending backend):**
```python
import hmac, hashlib
from urllib.parse import quote

def make_unsubscribe_url(backend_id, api_key, sender_email, receiver_email):
    msg = f"{backend_id}{sender_email}{receiver_email}".encode()
    sig = hmac.new(api_key.encode(), msg, hashlib.sha256).hexdigest()
    sender  = quote(sender_email,  safe="")
    receiver = quote(receiver_email, safe="")
    return f"https://your-domain.com/optout/unsubscribe/{backend_id}/{sender}/{receiver}?sig={sig}"
```

---

### `GET /optout/unsubscribe/{backend_id}/{sender_email}/{receiver_email}?sig={sig}`

One-click unsubscribe link. URL-encode both email addresses. The `sig` query param is required — requests with an invalid or missing signature return 404 (same as an invalid `backend_id`, to prevent enumeration).

```bash
# Generate sig first in Python, then test:
curl "http://localhost:8001/optout/unsubscribe/backend_abc123/noreply%40acme.com/user%40example.com?sig=YOUR_COMPUTED_SIG"
```

> Embed as a link in your email footer:
> ```html
> <a href="https://your-domain.com/optout/unsubscribe/backend_abc123/noreply%40acme.com/user%40example.com?sig=YOUR_SIG">
>   Unsubscribe
> </a>
> ```

The recipient sees a confirmation page. Clicking multiple times is safe — the operation is idempotent.

---

### `GET /optout/check`

Check whether a receiver has unsubscribed from a specific sender under your backend. Secured with `X-Api-Key` header.

```bash
curl "http://localhost:8001/optout/check?sender_email=noreply@acme.com&receiver_email=user@example.com" \
  -H "X-Api-Key: bk_xxxxxxxxxxxxxxxxxxx"
```

**Response — opted out:**
```json
{
  "status": "opted_out",
  "sender_email": "noreply@acme.com",
  "receiver_email": "user@example.com",
  "opted_out_at": "2024-01-15T14:30:00",
  "should_send": false
}
```

**Response — still subscribed:**
```json
{
  "status": "subscribed",
  "sender_email": "noreply@acme.com",
  "receiver_email": "user@example.com",
  "should_send": true
}
```

---

## Health & Meta

### `GET /health`

```bash
curl http://localhost:8001/health
```

```json
{
  "status": "healthy",
  "database": "connected",
  "active_backends": 3,
  "unprocessed_reads": 12,
  "timestamp": "2024-01-15T15:00:00"
}
```

### `GET /`

```bash
curl http://localhost:8001/
```

```json
{
  "service": "Email Microservice",
  "version": "2.0.0",
  "modules": ["read-receipt", "optout"],
  "status": "running"
}
```

---

## Project Structure

```
├── .env
├── main.py                      # Entry point, admin routes, app setup
├── database.py                  # Shared DB connection + schema init
├── email_read_router.py         # Read receipt endpoints
├── email_optout_router.py       # Opt-out / unsubscribe endpoints
├── test_email_microservice.py   # End-to-end test suite
├── requirements.txt
├── data/                        # SQLite database (auto-created)
├── Makefile
└── docker/
    ├── Dockerfile
    └── docker-compose.yml
```