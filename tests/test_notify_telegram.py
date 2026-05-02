"""Tests for the Telegram failure notifier."""
from __future__ import annotations

import pytest

from notify_telegram import build_message, send


def test_build_message_includes_run_url_and_summary():
    msg = build_message(
        summary="Schema validation failed: missing PopsimPop",
        run_url="https://github.com/u/r/actions/runs/123",
    )
    assert "Schema validation failed" in msg
    assert "PopsimPop" in msg
    assert "https://github.com/u/r/actions/runs/123" in msg
    assert "scorp_dashboard sync" in msg.lower()


def test_send_no_op_when_token_missing(monkeypatch):
    """When token/chat env vars are absent, send() must not raise."""
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    # Should silently no-op — failure-on-failure is a worse experience than no notification.
    send("any message")


def test_send_posts_to_telegram_api(monkeypatch):
    """When env vars are present, send() POSTs to the right URL with the right body."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "abc:123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "999")
    posted = {}

    def fake_post(url, json, timeout):
        posted["url"] = url
        posted["json"] = json
        posted["timeout"] = timeout

        class R:
            status_code = 200

            def raise_for_status(self):
                pass

        return R()

    monkeypatch.setattr("notify_telegram.requests.post", fake_post)

    send("hello")
    assert posted["url"] == "https://api.telegram.org/botabc:123/sendMessage"
    assert posted["json"]["chat_id"] == "999"
    assert posted["json"]["text"] == "hello"
