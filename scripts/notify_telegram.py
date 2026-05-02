"""Send sync-failure notifications to Telegram. Silent no-op when unconfigured."""
from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger(__name__)


def build_message(*, summary: str, run_url: str) -> str:
    return (
        "scorp_dashboard sync failed\n"
        f"\n{summary}\n"
        f"\nRun: {run_url}"
    )


def send(text: str) -> None:
    """POST to Telegram if configured. Failures here are logged, never re-raised."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.info("Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID); skipping")
        return
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        r.raise_for_status()
    except Exception as exc:  # noqa: BLE001 — never let notification failure mask the real error
        logger.warning("Telegram notification failed: %s", exc)
