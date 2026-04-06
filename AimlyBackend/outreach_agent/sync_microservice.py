"""
sync_microservice.py — Polls the read-receipt microservice and syncs read status to the DB.

Runs as a background asyncio task launched from main.py lifespan.
"""

import asyncio
import os
import ssl
from datetime import datetime

import aiohttp
from core.database.connection import get_connection


class MicroserviceClient:

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers  = {
            "X-Api-Key":    api_key,
            "Content-Type": "application/json",
        }
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            ssl_ctx                = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode    = ssl.CERT_NONE
            connector              = aiohttp.TCPConnector(ssl=ssl_ctx)
            self._session          = aiohttp.ClientSession(
                headers=self.headers, connector=connector
            )
        return self._session

    async def _fetch_read_emails(self) -> list:
        url     = f"{self.base_url}/read-receipt/pending"
        session = await self._get_session()
        async with session.get(url) as resp:
            if resp.status == 200:
                data  = await resp.json()
                reads = data.get("reads", [])
                print(f"[Microservice] Fetched {len(reads)} read(s) at {datetime.utcnow().isoformat()}")
                return reads
        return []

    async def _mark_processed(self, log_ids: list) -> None:
        if not log_ids:
            return
        url     = f"{self.base_url}/read-receipt/acknowledge"
        session = await self._get_session()
        await session.post(url, json={"read_ids": log_ids})

    async def sync(self) -> None:
        reads = await self._fetch_read_emails()
        if not reads:
            return

        processed_ids = []
        for read in reads:
            log_id   = read.get("id")
            email_id = read.get("email_id")
            read_at  = read.get("read_at")

            if email_id and read_at:
                try:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, self._mark_email_read, email_id)
                    processed_ids.append(log_id)
                except Exception as exc:
                    print(f"[Microservice] DB error for email_id={email_id}: {exc}")

        await self._mark_processed(processed_ids)

    def _mark_email_read(self, email_id: int) -> None:
        try:
            with get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("SELECT id FROM emails WHERE id = %s", (email_id,))
                if not cursor.fetchone():
                    print(f"[Microservice] Email ID {email_id} not found")
                    return

                cursor.execute("""
                    UPDATE emails
                    SET read_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND read_at IS NULL
                """, (email_id,))

                if cursor.rowcount > 0:
                    print(f"[Microservice] Marked email {email_id} as read")
                else:
                    print(f"[Microservice] Email {email_id} already marked as read")

                conn.commit()

        except Exception as exc:
            print(f"[Microservice] Error marking email {email_id} as read: {exc}")
            raise

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()


async def run_sync_microservice() -> None:
    base_url = os.getenv("MICROSERVICE_BASE_URL")
    api_key  = os.getenv("MICROSERVICE_API_KEY")

    if not base_url or not api_key:
        print("[Microservice] MICROSERVICE_BASE_URL or MICROSERVICE_API_KEY not set — sync disabled")
        return

    client = MicroserviceClient(base_url=base_url, api_key=api_key)

    try:
        while True:
            try:
                await client.sync()
            except Exception as exc:
                print(f"[Microservice] Sync loop error: {exc}")
            print("[Microservice] Next sync in 30s…")
            await asyncio.sleep(30)
    except asyncio.CancelledError:
        print("[Microservice] Sync task cancelled")
        raise
    finally:
        await client.close()
        print("[Microservice] Client session closed")