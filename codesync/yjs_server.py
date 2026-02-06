#!/usr/bin/env python3
"""
Y.js WebSocket Server (y-websocket compatible)

This is a standalone WebSocket server that implements the y-websocket protocol
for CRDT document synchronization. It runs on port 8001 and handles:

1. Y.js document state synchronization
2. Awareness (user cursors, presence)
3. Redis pub/sub for multi-server scaling

Usage:
    python yjs_server.py

Requirements:
    pip install websockets redis
"""

import asyncio
import json
import struct
import logging
from typing import Dict, Set, Optional
from dataclasses import dataclass, field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [Y.js] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

try:
    import websockets
    from websockets.asyncio.server import serve
    from websockets.asyncio.server import ServerConnection as WebSocketServerProtocol
    WEBSOCKETS_V15 = True
except ImportError:
    try:
        # Fallback for older versions
        import websockets
        from websockets.server import serve, WebSocketServerProtocol
        WEBSOCKETS_V15 = False
    except ImportError:
        logger.error("websockets not installed. Run: pip install websockets")
        exit(1)

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis not available for pub/sub scaling")


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
    """Represents a Y.js document's server-side state"""
    doc_id: str
    updates: list = field(default_factory=list)
    awareness_states: Dict[int, bytes] = field(default_factory=dict)
    clients: Set[WebSocketServerProtocol] = field(default_factory=set)
    
    def apply_update(self, update: bytes) -> None:
        """Apply a Y.js update to the document"""
        self.updates.append(update)
        logger.debug(f"Document {self.doc_id}: Applied update ({len(update)} bytes), total updates: {len(self.updates)}")
    
    def get_encoded_state(self) -> bytes:
        """Get all updates concatenated"""
        if not self.updates:
            return b''
        return b''.join(self.updates)
    
    def get_update_count(self) -> int:
        """Get number of updates (for GC decisions)"""
        return len(self.updates)
    
    def gc_updates(self, keep_last: int = 100) -> None:
        """Garbage collect old updates to save memory"""
        if len(self.updates) > keep_last:
            # Merge all updates into one
            merged = b''.join(self.updates)
            self.updates = [merged]
            logger.info(f"Document {self.doc_id}: GC'd updates, merged into 1")


class YjsServer:
    """
    Y.js WebSocket Server implementing y-websocket protocol.
    
    Features:
    - Document state synchronization
    - Multi-client awareness
    - Redis pub/sub for scaling
    - Memory management with GC
    """
    
    def __init__(self, host: str = '0.0.0.0', port: int = 8001):
        self.host = host
        self.port = port
        self.documents: Dict[str, YjsDocument] = {}
        self.client_docs: Dict[WebSocketServerProtocol, str] = {}
        self.client_ids: Dict[WebSocketServerProtocol, int] = {}
        self.next_client_id = 1
        self.redis: Optional[aioredis.Redis] = None
    
    def get_document(self, doc_id: str) -> YjsDocument:
        """Get or create a document"""
        if doc_id not in self.documents:
            self.documents[doc_id] = YjsDocument(doc_id=doc_id)
            logger.info(f"Created document: {doc_id}")
        return self.documents[doc_id]
    
    async def setup_redis(self) -> None:
        """Set up Redis connection for pub/sub"""
        if REDIS_AVAILABLE:
            try:
                self.redis = await aioredis.from_url('redis://localhost:6379')
                await self.redis.ping()
                logger.info("Connected to Redis for pub/sub")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
                self.redis = None
    
    async def handle_client(self, websocket: WebSocketServerProtocol) -> None:
        """Handle a WebSocket connection"""
        # In websockets 15.x, path is an attribute of the websocket object
        # In older versions, it was passed as a parameter
        if hasattr(websocket, 'request') and hasattr(websocket.request, 'path'):
            # websockets 15.x
            path = websocket.request.path
        elif hasattr(websocket, 'path'):
            # older websockets
            path = websocket.path
        else:
            path = '/default'
            
        # Extract document ID from path (e.g., /codesync-123)
        doc_id = path.strip('/') or 'default'
        document = self.get_document(doc_id)
        
        # Assign client ID
        client_id = self.next_client_id
        self.next_client_id += 1
        self.client_ids[websocket] = client_id
        self.client_docs[websocket] = doc_id
        document.clients.add(websocket)
        
        logger.info(f"Client {client_id} connected to document '{doc_id}' (total: {len(document.clients)})")
        
        try:
            # Send initial sync (request client state)
            await self.send_sync_step1(websocket)
            
            # Send existing document state
            await self.send_sync_step2(websocket, document)
            
            # Send existing awareness states
            await self.send_awareness_states(websocket, document)
            
            # Handle incoming messages
            async for message in websocket:
                if isinstance(message, bytes):
                    await self.handle_binary_message(websocket, message, document)
                else:
                    await self.handle_text_message(websocket, message, document)
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} disconnected from '{doc_id}'")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            # Cleanup
            document.clients.discard(websocket)
            self.client_docs.pop(websocket, None)
            
            # Remove awareness
            if client_id in document.awareness_states:
                del document.awareness_states[client_id]
                await self.broadcast_awareness_removal(document, client_id)
            
            self.client_ids.pop(websocket, None)
            logger.info(f"Client {client_id} cleaned up from '{doc_id}' (remaining: {len(document.clients)})")
    
    async def handle_binary_message(self, websocket: WebSocketServerProtocol, data: bytes, document: YjsDocument) -> None:
        """Handle binary Y.js protocol message"""
        if len(data) < 1:
            return
        
        message_type = data[0]
        payload = data[1:]
        
        if message_type == MESSAGE_SYNC:
            await self.handle_sync_message(websocket, payload, document)
        elif message_type == MESSAGE_AWARENESS:
            await self.handle_awareness_message(websocket, payload, document)
        elif message_type == MESSAGE_QUERY_AWARENESS:
            await self.send_awareness_states(websocket, document)
    
    async def handle_text_message(self, websocket: WebSocketServerProtocol, data: str, document: YjsDocument) -> None:
        """Handle JSON text messages (for hybrid protocol)"""
        try:
            msg = json.loads(data)
            msg_type = msg.get('type')
            
            if msg_type == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))
            elif msg_type == 'ai_fix':
                # AI agent applying a fix
                logger.info(f"AI fix request: line {msg.get('line')}")
                # The actual fix is handled through CRDT updates
        except json.JSONDecodeError:
            pass
    
    async def handle_sync_message(self, websocket: WebSocketServerProtocol, payload: bytes, document: YjsDocument) -> None:
        """Handle Y.js sync messages"""
        if len(payload) < 1:
            return
        
        sync_type = payload[0]
        sync_data = payload[1:]
        
        client_id = self.client_ids.get(websocket, 0)
        
        if sync_type == SYNC_STEP1:
            # Client requesting sync, send our state
            logger.debug(f"Client {client_id}: Sync step 1 received")
            await self.send_sync_step2(websocket, document)
            
        elif sync_type == SYNC_STEP2:
            # Client sending their state diff
            if sync_data:
                document.apply_update(sync_data)
                logger.debug(f"Client {client_id}: Sync step 2 received ({len(sync_data)} bytes)")
            
        elif sync_type == SYNC_UPDATE:
            # Regular update from client
            if sync_data:
                document.apply_update(sync_data)
                logger.info(f"Client {client_id}: Update received ({len(sync_data)} bytes)")
                
                # Broadcast to other clients
                await self.broadcast_update(websocket, sync_data, document)
                
                # GC if too many updates
                if document.get_update_count() > 200:
                    document.gc_updates(keep_last=100)
    
    async def handle_awareness_message(self, websocket: WebSocketServerProtocol, payload: bytes, document: YjsDocument) -> None:
        """Handle awareness updates (user cursors, presence)"""
        client_id = self.client_ids.get(websocket, 0)
        
        # Store awareness state
        document.awareness_states[client_id] = payload
        
        # Broadcast to other clients
        await self.broadcast_awareness(websocket, payload, document)
        
        logger.debug(f"Client {client_id}: Awareness update ({len(payload)} bytes)")
    
    async def send_sync_step1(self, websocket: WebSocketServerProtocol) -> None:
        """Send sync step 1 - request client state"""
        message = bytes([MESSAGE_SYNC, SYNC_STEP1])
        await websocket.send(message)
    
    async def send_sync_step2(self, websocket: WebSocketServerProtocol, document: YjsDocument) -> None:
        """Send sync step 2 - send document state"""
        state = document.get_encoded_state()
        if state:
            message = bytes([MESSAGE_SYNC, SYNC_STEP2]) + state
            await websocket.send(message)
            logger.debug(f"Sent sync step 2 ({len(state)} bytes)")
    
    async def send_awareness_states(self, websocket: WebSocketServerProtocol, document: YjsDocument) -> None:
        """Send all awareness states to a client"""
        for client_id, state in document.awareness_states.items():
            message = bytes([MESSAGE_AWARENESS]) + struct.pack('<I', client_id) + state
            await websocket.send(message)
    
    async def broadcast_update(self, sender: WebSocketServerProtocol, update: bytes, document: YjsDocument) -> None:
        """Broadcast update to all clients except sender"""
        message = bytes([MESSAGE_SYNC, SYNC_UPDATE]) + update
        
        for client in document.clients:
            if client != sender:
                try:
                    await client.send(message)
                except:
                    pass
        
        # Also publish to Redis for other server instances
        if self.redis:
            await self.redis.publish(
                f'yjs:{document.doc_id}:update',
                update.hex()
            )
    
    async def broadcast_awareness(self, sender: WebSocketServerProtocol, awareness: bytes, document: YjsDocument) -> None:
        """Broadcast awareness to all clients except sender"""
        client_id = self.client_ids.get(sender, 0)
        message = bytes([MESSAGE_AWARENESS]) + struct.pack('<I', client_id) + awareness
        
        for client in document.clients:
            if client != sender:
                try:
                    await client.send(message)
                except:
                    pass
    
    async def broadcast_awareness_removal(self, document: YjsDocument, removed_client_id: int) -> None:
        """Broadcast that a client's awareness has been removed"""
        # Send awareness with null state to indicate removal
        message = bytes([MESSAGE_AWARENESS]) + struct.pack('<I', removed_client_id) + b'\x00'
        
        for client in document.clients:
            try:
                await client.send(message)
            except:
                pass
    
    async def run(self) -> None:
        """Start the Y.js WebSocket server"""
        await self.setup_redis()
        
        logger.info(f"Starting Y.js WebSocket server on ws://{self.host}:{self.port}")
        logger.info("Features: CRDT sync, Awareness, Redis pub/sub (if available)")
        
        async with serve(self.handle_client, self.host, self.port):
            logger.info(f"✓ Y.js server ready at ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever


async def main():
    server = YjsServer(host='0.0.0.0', port=8001)
    await server.run()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped")
