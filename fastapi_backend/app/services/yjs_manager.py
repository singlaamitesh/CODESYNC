"""
Y.js Document Manager - CRDT State Management
Manages Y.js documents, awareness, and cross-client synchronization
"""
import asyncio
from typing import Dict, Set, Optional, List
import struct
import logging
from dataclasses import dataclass, field

from app.services.redis_manager import RedisManager

logger = logging.getLogger(__name__)

# Y.js message types (from y-websocket protocol)
MESSAGE_SYNC = 0
MESSAGE_AWARENESS = 1
MESSAGE_AUTH = 2
MESSAGE_QUERY_AWARENESS = 3

# Sync message subtypes
SYNC_STEP1 = 0
SYNC_STEP2 = 1
SYNC_UPDATE = 2


@dataclass
class YjsDocument:
    """
    Represents a Y.js document's server-side state
    Stores CRDT updates and user awareness
    """
    doc_id: str
    updates: List[bytes] = field(default_factory=list)
    awareness_states: Dict[int, bytes] = field(default_factory=dict)
    clients: Set[str] = field(default_factory=set)
    
    def apply_update(self, update: bytes) -> None:
        """Apply a Y.js update to the document"""
        self.updates.append(update)
        logger.debug(f"[Y.js Doc {self.doc_id}] Applied update ({len(update)} bytes)")
    
    def get_encoded_state(self) -> bytes:
        """Get all updates concatenated"""
        if not self.updates:
            return b''
        return b''.join(self.updates)
    
    def get_update_count(self) -> int:
        """Get number of updates"""
        return len(self.updates)
    
    def gc_updates(self, keep_last: int = 100) -> None:
        """Garbage collect old updates to save memory"""
        if len(self.updates) > keep_last:
            # Merge all updates into one
            merged = b''.join(self.updates)
            self.updates = [merged]
            logger.info(f"[Y.js Doc {self.doc_id}] GC'd updates, merged into 1")
    
    def set_awareness(self, client_id: int, state: bytes) -> None:
        """Set awareness state for a client"""
        self.awareness_states[client_id] = state
    
    def remove_awareness(self, client_id: int) -> None:
        """Remove awareness state"""
        self.awareness_states.pop(client_id, None)
    
    def get_awareness_update(self) -> bytes:
        """Get all awareness states as update message"""
        if not self.awareness_states:
            return b''
        
        # Format: [client_id (4 bytes), state_length (4 bytes), state]
        states = []
        for client_id, state in self.awareness_states.items():
            states.append(struct.pack('<I', client_id))
            states.append(struct.pack('<I', len(state)))
            states.append(state)
        
        return b''.join(states)


class YjsDocumentManager:
    """
    Manages Y.js documents across all WebSocket connections
    Handles cross-server synchronization via Redis
    """
    _instance: Optional['YjsDocumentManager'] = None
    _documents: Dict[str, YjsDocument] = {}
    _redis: Optional[RedisManager] = None
    
    @classmethod
    async def get_instance(cls) -> 'YjsDocumentManager':
        """Get or create singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance.initialize()
        return cls._instance
    
    async def initialize(self):
        """Initialize manager with Redis connection"""
        self._redis = await RedisManager.get_instance()
        logger.info("✅ [Y.js Manager] Initialized")
    
    def get_document(self, doc_id: str) -> YjsDocument:
        """Get or create a Y.js document"""
        if doc_id not in self._documents:
            self._documents[doc_id] = YjsDocument(doc_id)
            logger.info(f"📄 [Y.js Manager] Created document: {doc_id}")
        return self._documents[doc_id]
    
    def get_all_documents(self) -> Dict[str, YjsDocument]:
        """Get all active documents"""
        return self._documents
    
    async def add_client(self, doc_id: str, client_id: str):
        """Add client to document"""
        doc = self.get_document(doc_id)
        doc.clients.add(client_id)
        logger.info(f"👤 [Y.js Manager] Client {client_id} joined document {doc_id} ({len(doc.clients)} clients)")
    
    async def remove_client(self, doc_id: str, client_id: str):
        """Remove client from document"""
        if doc_id in self._documents:
            doc = self._documents[doc_id]
            doc.clients.discard(client_id)
            logger.info(f"👋 [Y.js Manager] Client {client_id} left document {doc_id} ({len(doc.clients)} clients)")
            
            # Clean up empty documents after 5 minutes
            if len(doc.clients) == 0:
                asyncio.create_task(self._cleanup_empty_document(doc_id))
    
    async def _cleanup_empty_document(self, doc_id: str):
        """Clean up document if still empty after delay"""
        await asyncio.sleep(300)  # 5 minutes
        if doc_id in self._documents:
            doc = self._documents[doc_id]
            if len(doc.clients) == 0:
                del self._documents[doc_id]
                logger.info(f"🗑️ [Y.js Manager] Cleaned up empty document: {doc_id}")
    
    async def broadcast_update(self, doc_id: str, update: bytes, sender_id: Optional[str] = None):
        """Broadcast update to all clients via Redis"""
        if not self._redis:
            return
        
        await self._redis.publish(f"yjs:{doc_id}:update", {
            "type": "update",
            "doc_id": doc_id,
            "sender_id": sender_id,
            "update": update.hex()  # Convert bytes to hex string for JSON
        })
    
    async def broadcast_awareness(self, doc_id: str, awareness: bytes, sender_id: Optional[str] = None):
        """Broadcast awareness update via Redis"""
        if not self._redis:
            return
        
        await self._redis.publish(f"yjs:{doc_id}:awareness", {
            "type": "awareness",
            "doc_id": doc_id,
            "sender_id": sender_id,
            "awareness": awareness.hex()
        })
    
    def get_document_stats(self) -> Dict[str, any]:
        """Get statistics about managed documents"""
        total_docs = len(self._documents)
        total_clients = sum(len(doc.clients) for doc in self._documents.values())
        total_updates = sum(doc.get_update_count() for doc in self._documents.values())
        
        return {
            "total_documents": total_docs,
            "total_clients": total_clients,
            "total_updates": total_updates,
            "documents": [
                {
                    "doc_id": doc_id,
                    "clients": len(doc.clients),
                    "updates": doc.get_update_count()
                }
                for doc_id, doc in self._documents.items()
            ]
        }
