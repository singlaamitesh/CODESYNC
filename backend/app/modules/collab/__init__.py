"""Collaboration module: real-time Y.js document sync over WebSocket."""
from .yjs_manager import (
    YjsDocumentManager,
    MESSAGE_SYNC, MESSAGE_AWARENESS,
    SYNC_STEP1, SYNC_STEP2, SYNC_UPDATE,
)

__all__ = [
    "YjsDocumentManager",
    "MESSAGE_SYNC", "MESSAGE_AWARENESS",
    "SYNC_STEP1", "SYNC_STEP2", "SYNC_UPDATE",
]
