"""
PocketBase auth integration.

FastAPI no longer mints JWTs; PocketBase does. This module exposes:

* `verify_pb_token(token)` — validates a PocketBase JWT by calling
  `POST {PB_URL}/api/collections/users/auth-refresh`, caching the result
  for `PB_AUTH_CACHE_TTL` seconds to avoid a round trip on every request.
* `require_pb_auth` — FastAPI dependency returning a `PbUser` or raising 401.
* `pb_user_from_token(token)` — for WebSocket connections (no dependency injection).
* `get_pb_admin_token()` — cached admin token for server-side writes (embeddings).
"""
import os
import time
import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

PB_URL = os.getenv("POCKETBASE_URL", "http://localhost:8090").rstrip("/")
PB_AUTH_CACHE_TTL = int(os.getenv("PB_AUTH_CACHE_TTL", "60"))
PB_ADMIN_EMAIL = os.getenv("PB_ADMIN_EMAIL", "")
PB_ADMIN_PASSWORD = os.getenv("PB_ADMIN_PASSWORD", "")

security = HTTPBearer(auto_error=False)


@dataclass
class PbUser:
    id: str
    email: str
    name: str
    avatar_url: str


_token_cache: dict[str, tuple[float, PbUser]] = {}
_admin_cache: dict[str, tuple[float, str]] = {}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def verify_pb_token(token: str) -> Optional[PbUser]:
    """Validate a PocketBase user JWT. Returns None on failure."""
    if not token:
        return None

    key = _hash(token)
    cached = _token_cache.get(key)
    now = time.time()
    if cached and cached[0] > now:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{PB_URL}/api/collections/users/auth-refresh",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as e:
        logger.warning(f"PocketBase auth-refresh transport error: {e}")
        return None

    if resp.status_code != 200:
        return None

    body = resp.json()
    record = body.get("record") or {}
    user = PbUser(
        id=record.get("id", ""),
        email=record.get("email", ""),
        name=record.get("name") or record.get("email", ""),
        avatar_url=record.get("avatar") or record.get("avatarUrl") or "",
    )
    _token_cache[key] = (now + PB_AUTH_CACHE_TTL, user)
    # Opportunistic cache cleanup
    if len(_token_cache) > 1024:
        for k in [k for k, (exp, _) in _token_cache.items() if exp <= now]:
            _token_cache.pop(k, None)
    return user


async def can_access_document(token: str, document_id: str) -> bool:
    """Authorization check: may the holder of `token` access `document_id`?

    Rather than re-implement PocketBase's access rules here, we ask PocketBase
    itself — fetching the document record *as the user* (with their token). The
    `documents` collection's viewRule already restricts reads to the workspace
    owner and its members, so a 200 means authorized and a 403/404 means not.
    This keeps a single source of truth for authorization (the PB schema).
    """
    if not token or not document_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{PB_URL}/api/collections/documents/records/{document_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as e:
        logger.warning(f"PocketBase document access check transport error: {e}")
        return False
    return resp.status_code == 200


async def require_pb_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> PbUser:
    token = credentials.credentials if credentials else None
    user = await verify_pb_token(token) if token else None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_pb_admin_token() -> Optional[str]:
    """Return a cached PocketBase admin JWT for server-side writes."""
    if not PB_ADMIN_EMAIL or not PB_ADMIN_PASSWORD:
        return None

    now = time.time()
    cached = _admin_cache.get("admin")
    if cached and cached[0] > now:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{PB_URL}/api/admins/auth-with-password",
                json={"identity": PB_ADMIN_EMAIL, "password": PB_ADMIN_PASSWORD},
            )
    except httpx.HTTPError as e:
        logger.error(f"PocketBase admin auth transport error: {e}")
        return None

    if resp.status_code != 200:
        logger.error(f"PocketBase admin auth failed: {resp.status_code} {resp.text}")
        return None

    token = resp.json().get("token")
    if token:
        _admin_cache["admin"] = (now + 30 * 60, token)
    return token
