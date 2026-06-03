"""Tests for document-access authorization (IDOR fix).

`can_access_document` delegates to PocketBase by fetching the document record
with the user's own token: a 200 means authorized, anything else means not.
We stub the HTTP layer so no real PocketBase is needed.
"""
import asyncio
from contextlib import asynccontextmanager

import httpx

from app.modules.auth import pb_auth


class _FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class _FakeClient:
    """Minimal async-context httpx.AsyncClient stand-in returning a fixed status."""

    def __init__(self, status_code: int, captured: dict):
        self._status = status_code
        self._captured = captured

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        self._captured["url"] = url
        self._captured["headers"] = headers or {}
        return _FakeResponse(self._status)


def _patch_client(monkeypatch, status_code: int) -> dict:
    captured: dict = {}
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda *a, **k: _FakeClient(status_code, captured)
    )
    return captured


def test_access_granted_when_pb_returns_200(monkeypatch):
    captured = _patch_client(monkeypatch, 200)
    ok = asyncio.run(pb_auth.can_access_document("tok123", "doc1"))
    assert ok is True
    # Fetches the right record, as the user (their bearer token).
    assert captured["url"].endswith("/api/collections/documents/records/doc1")
    assert captured["headers"]["Authorization"] == "Bearer tok123"


def test_access_denied_when_pb_returns_403(monkeypatch):
    _patch_client(monkeypatch, 403)
    assert asyncio.run(pb_auth.can_access_document("tok", "doc1")) is False


def test_access_denied_when_pb_returns_404(monkeypatch):
    _patch_client(monkeypatch, 404)
    assert asyncio.run(pb_auth.can_access_document("tok", "missing")) is False


def test_access_denied_on_empty_token_or_doc():
    assert asyncio.run(pb_auth.can_access_document("", "doc1")) is False
    assert asyncio.run(pb_auth.can_access_document("tok", "")) is False


def test_access_denied_on_transport_error(monkeypatch):
    @asynccontextmanager
    async def _boom(*a, **k):
        raise httpx.HTTPError("network down")
        yield  # pragma: no cover

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: _boom())
    assert asyncio.run(pb_auth.can_access_document("tok", "doc1")) is False
