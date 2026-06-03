"""Auth module: PocketBase token verification + FastAPI auth dependency."""
from .pb_auth import (
    PbUser,
    verify_pb_token,
    require_pb_auth,
    get_pb_admin_token,
    can_access_document,
)

__all__ = [
    "PbUser",
    "verify_pb_token",
    "require_pb_auth",
    "get_pb_admin_token",
    "can_access_document",
]
