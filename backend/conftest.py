import asyncio
import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def _reset_pb_auth_cache(monkeypatch):
    """Each test starts with empty token caches."""
    from app.modules.auth import pb_auth
    pb_auth._token_cache.clear()
    pb_auth._admin_cache.clear()
