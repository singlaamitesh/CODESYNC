"""
WebSocket Router - Real-time Collaboration with CRDTs
Implements Y.js protocol for conflict-free editing
Also provides JSON WebSocket for AI analysis and cursor sync
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import struct
import asyncio
import logging
import json
import time

from app.services.yjs_manager import YjsDocumentManager, MESSAGE_SYNC, MESSAGE_AWARENESS, SYNC_STEP1, SYNC_STEP2, SYNC_UPDATE
from app.services.redis_manager import RedisManager
from app.services.ai_service import AIService
from app.database import SessionLocal, Document as DBDocument

logger = logging.getLogger(__name__)
router = APIRouter()

# Active WebSocket connections
active_connections: Dict[str, Set[WebSocket]] = {}


class ConnectionManager:
    """Manages WebSocket connections for each document"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, doc_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        if doc_id not in self.active_connections:
            self.active_connections[doc_id] = set()
        self.active_connections[doc_id].add(websocket)
        logger.info(f"✅ [WS] Client connected to document {doc_id}")
    
    def disconnect(self, websocket: WebSocket, doc_id: str):
        """Remove WebSocket connection"""
        if doc_id in self.active_connections:
            self.active_connections[doc_id].discard(websocket)
            if len(self.active_connections[doc_id]) == 0:
                del self.active_connections[doc_id]
        logger.info(f"👋 [WS] Client disconnected from document {doc_id}")
    
    async def broadcast(self, doc_id: str, message: bytes, exclude: WebSocket = None):
        """Broadcast message to all clients in a document"""
        if doc_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[doc_id]:
            if connection != exclude:
                try:
                    await connection.send_bytes(message)
                except:
                    disconnected.add(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn, doc_id)
    
    def get_client_count(self, doc_id: str) -> int:
        """Get number of connected clients for a document"""
        return len(self.active_connections.get(doc_id, set()))


manager = ConnectionManager()


@router.websocket("/yjs/{doc_id}")
async def yjs_websocket(websocket: WebSocket, doc_id: str):
    """
    Y.js WebSocket endpoint for CRDT synchronization
    Implements y-websocket protocol
    """
    await manager.connect(websocket, doc_id)
    
    # Get Y.js document manager
    yjs_manager = await YjsDocumentManager.get_instance()
    doc = yjs_manager.get_document(doc_id)
    
    client_id = f"client-{id(websocket)}"
    await yjs_manager.add_client(doc_id, client_id)
    
    # Send initial sync message (SYNC_STEP1)
    try:
        # Send existing document state
        state_vector = doc.get_encoded_state()
        if state_vector:
            sync_message = bytes([MESSAGE_SYNC, SYNC_STEP2]) + state_vector
            await websocket.send_bytes(sync_message)
            logger.debug(f"📤 [Y.js] Sent initial state to {client_id} ({len(state_vector)} bytes)")
    except Exception as e:
        logger.error(f"❌ [Y.js] Error sending initial state: {e}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_bytes()
            
            if len(data) == 0:
                continue
            
            message_type = data[0]
            
            if message_type == MESSAGE_SYNC:
                # Handle sync message
                await handle_sync_message(websocket, doc_id, data[1:], doc, client_id)
            
            elif message_type == MESSAGE_AWARENESS:
                # Handle awareness (cursor, selection, etc.)
                await handle_awareness_message(websocket, doc_id, data[1:], doc, client_id)
            
            else:
                logger.warning(f"⚠️ [Y.js] Unknown message type: {message_type}")
    
    except WebSocketDisconnect:
        logger.info(f"🔌 [Y.js] Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"❌ [Y.js] WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, doc_id)
        await yjs_manager.remove_client(doc_id, client_id)


async def handle_sync_message(websocket: WebSocket, doc_id: str, data: bytes, doc, client_id: str):
    """Handle Y.js sync messages (CRDT updates)"""
    if len(data) == 0:
        return
    
    sync_type = data[0]
    payload = data[1:]
    
    if sync_type == SYNC_STEP1:
        # Client requests state vector
        logger.debug(f"📥 [Y.js] {client_id} requested state vector")
        state_vector = doc.get_encoded_state()
        if state_vector:
            response = bytes([MESSAGE_SYNC, SYNC_STEP2]) + state_vector
            await websocket.send_bytes(response)
    
    elif sync_type == SYNC_STEP2:
        # Client sends missing updates
        logger.debug(f"📥 [Y.js] {client_id} sent state vector ({len(payload)} bytes)")
        # In a full implementation, compute diff and send missing updates
        pass
    
    elif sync_type == SYNC_UPDATE:
        # Client sends document update
        logger.info(f"📝 [Y.js] {client_id} sent update ({len(payload)} bytes)")
        
        # Apply update to document
        doc.apply_update(payload)
        
        # Broadcast to other clients
        broadcast_message = bytes([MESSAGE_SYNC, SYNC_UPDATE]) + payload
        await manager.broadcast(doc_id, broadcast_message, exclude=websocket)
        
        # Also broadcast via Redis for cross-server sync
        yjs_manager = await YjsDocumentManager.get_instance()
        await yjs_manager.broadcast_update(doc_id, payload, client_id)
        
        # Garbage collect if needed
        if doc.get_update_count() > 1000:
            doc.gc_updates()


async def handle_awareness_message(websocket: WebSocket, doc_id: str, data: bytes, doc, client_id: str):
    """Handle awareness updates (cursor position, selection, user info)"""
    logger.debug(f"👁️ [Y.js] {client_id} sent awareness update ({len(data)} bytes)")
    
    # Broadcast awareness to other clients
    awareness_message = bytes([MESSAGE_AWARENESS]) + data
    await manager.broadcast(doc_id, awareness_message, exclude=websocket)
    
    # Also broadcast via Redis
    yjs_manager = await YjsDocumentManager.get_instance()
    await yjs_manager.broadcast_awareness(doc_id, data, client_id)


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    yjs_manager = await YjsDocumentManager.get_instance()
    stats = yjs_manager.get_document_stats()
    
    return {
        "websocket_connections": {
            doc_id: manager.get_client_count(doc_id)
            for doc_id in manager.active_connections.keys()
        },
        "editor_connections": {
            doc_id: len(conns)
            for doc_id, conns in editor_connections.items()
        },
        **stats
    }


# ========================================================
# JSON WebSocket for AI Analysis & Collaborative Editing
# (Replaces Django's DocumentConsumer)
# ========================================================

editor_connections: Dict[str, Set[WebSocket]] = {}
# Debounce tasks per connection
_debounce_tasks: Dict[str, asyncio.Task] = {}
DEBOUNCE_DELAY = 0.5  # 500ms


async def editor_broadcast(doc_id: str, message: dict, exclude: WebSocket = None):
    """Broadcast JSON message to all editor clients in a document"""
    if doc_id not in editor_connections:
        return
    disconnected = set()
    for ws in editor_connections[doc_id]:
        if ws != exclude:
            try:
                await ws.send_json(message)
            except:
                disconnected.add(ws)
    for ws in disconnected:
        editor_connections[doc_id].discard(ws)


@router.websocket("/editor/{document_id}")
async def editor_websocket(websocket: WebSocket, document_id: str):
    """
    JSON-based WebSocket for AI analysis, cursor sync, and collaborative edits.
    This is separate from the Y.js binary WebSocket.
    Frontend's useWebSocket hook connects here.
    """
    await websocket.accept()
    
    # Register connection
    if document_id not in editor_connections:
        editor_connections[document_id] = set()
    editor_connections[document_id].add(websocket)
    
    last_content = ""
    
    logger.info(f"✅ [Editor WS] Client connected to document {document_id}")
    
    # Send welcome message with document info
    try:
        db = SessionLocal()
        try:
            doc_id_int = int(document_id)
            doc = db.query(DBDocument).filter(DBDocument.id == doc_id_int).first()
            doc_info = {
                "id": doc.id,
                "title": doc.title,
                "content": doc.content[:200] if doc else "",
            } if doc else None
        except (ValueError, Exception):
            doc_info = None
        finally:
            db.close()
        
        await websocket.send_json({
            "type": "connection",
            "message": f"Connected to document {document_id}",
            "document": doc_info,
        })
    except Exception as e:
        logger.error(f"[Editor WS] Error sending welcome: {e}")
    
    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
            except json.JSONDecodeError:
                continue
            
            message_type = data.get("type", "edit")
            
            if message_type == "edit":
                await handle_editor_edit(websocket, document_id, data, last_content)
                last_content = data.get("content", last_content)
            
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif message_type == "cursor_move":
                cursor = data.get("cursor", {})
                await editor_broadcast(document_id, {
                    "type": "cursor_update",
                    "cursor": cursor,
                }, exclude=websocket)
            
            elif message_type == "request_ai_analysis":
                content = data.get("content", "")
                await run_ai_analysis_for_ws(websocket, document_id, content)
            
            elif message_type == "request_optimization":
                await run_optimization_for_ws(websocket, document_id)
            
            else:
                logger.debug(f"[Editor WS] Unknown message type: {message_type}")
    
    except WebSocketDisconnect:
        logger.info(f"🔌 [Editor WS] Client disconnected from document {document_id}")
    except Exception as e:
        logger.error(f"❌ [Editor WS] Error: {e}")
    finally:
        if document_id in editor_connections:
            editor_connections[document_id].discard(websocket)
            if not editor_connections[document_id]:
                del editor_connections[document_id]
        # Cancel debounce task
        task_key = f"{document_id}_{id(websocket)}"
        if task_key in _debounce_tasks:
            _debounce_tasks[task_key].cancel()
            del _debounce_tasks[task_key]


async def handle_editor_edit(websocket: WebSocket, document_id: str, data: dict, last_content: str):
    """Handle code edit - save to DB, broadcast, and schedule AI analysis"""
    content = data.get("content", "")
    
    if content == last_content:
        return
    
    # Save to database
    try:
        db = SessionLocal()
        try:
            doc_id_int = int(document_id)
            doc = db.query(DBDocument).filter(DBDocument.id == doc_id_int).first()
            if doc:
                doc.content = content
                db.commit()
        except (ValueError, Exception) as e:
            logger.error(f"[Editor WS] DB save error: {e}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[Editor WS] DB error: {e}")
    
    # Broadcast edit to other clients
    await editor_broadcast(document_id, {
        "type": "edit",
        "content": content,
        "user_type": "human",
    }, exclude=websocket)
    
    # Schedule debounced AI analysis
    task_key = f"{document_id}_{id(websocket)}"
    if task_key in _debounce_tasks:
        _debounce_tasks[task_key].cancel()
    
    async def debounced_analysis():
        try:
            await asyncio.sleep(DEBOUNCE_DELAY)
            await websocket.send_json({
                "type": "ai_status",
                "status": "analyzing",
                "message": "AI analyzing..."
            })
            await run_ai_analysis_for_ws(websocket, document_id, content)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[Editor WS] Debounced analysis error: {e}")
    
    _debounce_tasks[task_key] = asyncio.create_task(debounced_analysis())


async def run_ai_analysis_for_ws(websocket: WebSocket, document_id: str, content: str = ""):
    """Run AI analysis and send results via WebSocket"""
    try:
        # Get content from DB if not provided
        if not content:
            db = SessionLocal()
            try:
                doc_id_int = int(document_id)
                doc = db.query(DBDocument).filter(DBDocument.id == doc_id_int).first()
                if doc:
                    content = doc.content
                    filename = doc.title
                else:
                    await websocket.send_json({"type": "ai_error", "message": "Document not found"})
                    return
            finally:
                db.close()
        else:
            filename = ""
        
        ai_service = AIService()
        result = await ai_service.analyze_code(code=content, filename=filename)
        
        await websocket.send_json({
            "type": "ai_suggestion",
            "suggestion_data": {
                "suggestions": result.get("suggestions", []),
                "analysis": result.get("analysis", {}),
            },
            "timestamp": int(time.time() * 1000)
        })
        
    except Exception as e:
        logger.error(f"[Editor WS] AI analysis error: {e}")
        try:
            await websocket.send_json({
                "type": "ai_error",
                "message": str(e)
            })
        except:
            pass


async def run_optimization_for_ws(websocket: WebSocket, document_id: str):
    """Run code optimization and send results via WebSocket"""
    try:
        await websocket.send_json({
            "type": "ai_status",
            "status": "optimizing",
            "message": "Optimizing code..."
        })
        
        db = SessionLocal()
        try:
            doc_id_int = int(document_id)
            doc = db.query(DBDocument).filter(DBDocument.id == doc_id_int).first()
            if not doc:
                await websocket.send_json({"type": "optimization_error", "message": "Document not found"})
                return
            content = doc.content
            filename = doc.title
        finally:
            db.close()
        
        ai_service = AIService()
        result = await ai_service.optimize_code(code=content, filename=filename)
        
        if "error" in result:
            await websocket.send_json({
                "type": "optimization_error",
                "message": result["error"]
            })
        else:
            await websocket.send_json({
                "type": "optimization_complete",
                "data": {
                    "optimization": result
                }
            })
        
    except Exception as e:
        logger.error(f"[Editor WS] Optimization error: {e}")
        try:
            await websocket.send_json({
                "type": "optimization_error",
                "message": str(e)
            })
        except:
            pass
