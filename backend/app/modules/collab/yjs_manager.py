"""
Y.js Document Manager — in-memory CRDT state.

Single-instance only. Redis pub/sub was removed because the droplet runs
one FastAPI worker; cross-instance sync is no longer a concern.
"""
import asyncio
from typing import Dict, Set, Optional, List
import struct
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

MESSAGE_SYNC = 0
MESSAGE_AWARENESS = 1
MESSAGE_AUTH = 2
MESSAGE_QUERY_AWARENESS = 3

SYNC_STEP1 = 0
SYNC_STEP2 = 1
SYNC_UPDATE = 2


@dataclass
class YjsDocument:
    doc_id: str
    updates: List[bytes] = field(default_factory=list)
    awareness_states: Dict[int, bytes] = field(default_factory=dict)
    clients: Set[str] = field(default_factory=set)

    def apply_update(self, update: bytes) -> None:
        self.updates.append(update)

    def get_encoded_state(self) -> bytes:
        if not self.updates:
            return b""
        return b"".join(self.updates)

    def get_update_count(self) -> int:
        return len(self.updates)

    def gc_updates(self, keep_last: int = 100) -> None:
        if len(self.updates) > keep_last:
            merged = b"".join(self.updates)
            self.updates = [merged]
            logger.info(f"[Y.js Doc {self.doc_id}] GC'd updates")

    def set_awareness(self, client_id: int, state: bytes) -> None:
        self.awareness_states[client_id] = state

    def remove_awareness(self, client_id: int) -> None:
        self.awareness_states.pop(client_id, None)

    def get_awareness_update(self) -> bytes:
        if not self.awareness_states:
            return b""
        parts = []
        for client_id, state in self.awareness_states.items():
            parts.append(struct.pack("<I", client_id))
            parts.append(struct.pack("<I", len(state)))
            parts.append(state)
        return b"".join(parts)


class YjsDocumentManager:
    _instance: Optional["YjsDocumentManager"] = None
    _documents: Dict[str, YjsDocument] = {}

    @classmethod
    async def get_instance(cls) -> "YjsDocumentManager":
        if cls._instance is None:
            cls._instance = cls()
            logger.info("✅ [Y.js Manager] Initialized (in-memory)")
        return cls._instance

    def get_document(self, doc_id: str) -> YjsDocument:
        if doc_id not in self._documents:
            self._documents[doc_id] = YjsDocument(doc_id)
            logger.info(f"📄 [Y.js] Created document: {doc_id}")
        return self._documents[doc_id]

    def get_all_documents(self) -> Dict[str, YjsDocument]:
        return self._documents

    async def add_client(self, doc_id: str, client_id: str):
        doc = self.get_document(doc_id)
        doc.clients.add(client_id)

    async def remove_client(self, doc_id: str, client_id: str):
        if doc_id in self._documents:
            doc = self._documents[doc_id]
            doc.clients.discard(client_id)
            if len(doc.clients) == 0:
                asyncio.create_task(self._cleanup_empty_document(doc_id))

    async def _cleanup_empty_document(self, doc_id: str):
        await asyncio.sleep(300)
        if doc_id in self._documents and len(self._documents[doc_id].clients) == 0:
            del self._documents[doc_id]
            logger.info(f"🗑️ [Y.js] Cleaned up empty document: {doc_id}")

    def get_document_stats(self) -> Dict[str, object]:
        total_docs = len(self._documents)
        total_clients = sum(len(d.clients) for d in self._documents.values())
        return {
            "total_documents": total_docs,
            "total_clients": total_clients,
            "total_updates": sum(d.get_update_count() for d in self._documents.values()),
        }
