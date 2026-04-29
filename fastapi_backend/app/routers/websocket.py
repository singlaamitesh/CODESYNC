"""
WebSocket Router — Real-time collaboration (Y.js) + editor JSON protocol.

All document persistence now happens via PocketBase on the client side.
These endpoints only broadcast between connected peers and drive AI
analysis. Chat moved to PocketBase realtime.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import logging
import json
import time

from app.services.yjs_manager import (
    YjsDocumentManager,
    MESSAGE_SYNC, MESSAGE_AWARENESS,
    SYNC_STEP1, SYNC_STEP2, SYNC_UPDATE,
)
from app.services.ai_service import AIService
from app.services.pb_auth import verify_pb_token

logger = logging.getLogger(__name__)
router = APIRouter()


async def _authorize_ws(websocket: WebSocket) -> bool:
    """Require a valid PocketBase token as a query param. Close on failure."""
    token = websocket.query_params.get("token", "")
    user = await verify_pb_token(token)
    if not user:
        await websocket.close(code=4401)
        return False
    return True


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, doc_id: str):
        await websocket.accept()
        self.active_connections.setdefault(doc_id, set()).add(websocket)
        logger.info(f"✅ [WS] Connected to {doc_id}")

    def disconnect(self, websocket: WebSocket, doc_id: str):
        if doc_id in self.active_connections:
            self.active_connections[doc_id].discard(websocket)
            if not self.active_connections[doc_id]:
                del self.active_connections[doc_id]

    async def broadcast(self, doc_id: str, message: bytes, exclude: WebSocket = None):
        if doc_id not in self.active_connections:
            return
        disconnected = set()
        for connection in list(self.active_connections.get(doc_id, set())):
            if connection != exclude:
                try:
                    await connection.send_bytes(message)
                except Exception:
                    disconnected.add(connection)
        for conn in disconnected:
            self.disconnect(conn, doc_id)

    def get_client_count(self, doc_id: str) -> int:
        return len(self.active_connections.get(doc_id, set()))


manager = ConnectionManager()


@router.websocket("/yjs/{doc_id}")
async def yjs_websocket(websocket: WebSocket, doc_id: str):
    """Y.js CRDT synchronization endpoint (y-websocket protocol)."""
    # Token verification happens before accept; we need to accept-then-close
    # for Starlette, but WebSocket.close before accept is a spec-compliant reject.
    token = websocket.query_params.get("token", "")
    if not await verify_pb_token(token):
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, doc_id)

    yjs_manager = await YjsDocumentManager.get_instance()
    doc = yjs_manager.get_document(doc_id)

    client_id = f"client-{id(websocket)}"
    await yjs_manager.add_client(doc_id, client_id)

    try:
        state_vector = doc.get_encoded_state()
        if state_vector:
            await websocket.send_bytes(bytes([MESSAGE_SYNC, SYNC_STEP2]) + state_vector)
    except Exception as e:
        logger.error(f"[Y.js] initial state error: {e}")

    try:
        while True:
            data = await websocket.receive_bytes()
            if not data:
                continue
            msg_type = data[0]
            if msg_type == MESSAGE_SYNC:
                await _handle_sync(websocket, doc_id, data[1:], doc, client_id)
            elif msg_type == MESSAGE_AWARENESS:
                await manager.broadcast(doc_id, bytes([MESSAGE_AWARENESS]) + data[1:], exclude=websocket)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[Y.js] error: {e}")
    finally:
        manager.disconnect(websocket, doc_id)
        await yjs_manager.remove_client(doc_id, client_id)


async def _handle_sync(websocket: WebSocket, doc_id: str, data: bytes, doc, client_id: str):
    if not data:
        return
    sync_type = data[0]
    payload = data[1:]
    if sync_type == SYNC_STEP1:
        state_vector = doc.get_encoded_state()
        if state_vector:
            await websocket.send_bytes(bytes([MESSAGE_SYNC, SYNC_STEP2]) + state_vector)
    elif sync_type == SYNC_UPDATE:
        doc.apply_update(payload)
        await manager.broadcast(
            doc_id, bytes([MESSAGE_SYNC, SYNC_UPDATE]) + payload, exclude=websocket,
        )
        if doc.get_update_count() > 1000:
            doc.gc_updates()


# ---------------------------------------------------------------------------
# Editor JSON WebSocket — cursor sync + AI analysis (no DB writes here).
# ---------------------------------------------------------------------------

editor_connections: Dict[str, Set[WebSocket]] = {}
_debounce_tasks: Dict[str, asyncio.Task] = {}
DEBOUNCE_DELAY = 0.5


async def editor_broadcast(doc_id: str, message: dict, exclude: WebSocket = None):
    if doc_id not in editor_connections:
        return
    disconnected = set()
    for ws in editor_connections[doc_id]:
        if ws != exclude:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(ws)
    for ws in disconnected:
        editor_connections[doc_id].discard(ws)


@router.websocket("/editor/{document_id}")
async def editor_websocket(websocket: WebSocket, document_id: str):
    """JSON WebSocket for cursor sync and AI analysis. Expects ?token=."""
    token = websocket.query_params.get("token", "")
    if not await verify_pb_token(token):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    editor_connections.setdefault(document_id, set()).add(websocket)

    await websocket.send_json({"type": "connection", "message": f"Connected to {document_id}"})

    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            msg_type = data.get("type", "edit")

            if msg_type == "edit":
                await _handle_editor_edit(websocket, document_id, data)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "cursor_move":
                await editor_broadcast(
                    document_id,
                    {"type": "cursor_update", "cursor": data.get("cursor", {})},
                    exclude=websocket,
                )
            elif msg_type == "request_ai_analysis":
                await _run_ai_analysis(websocket, document_id, data.get("content", ""), data.get("filename", ""))
            elif msg_type == "request_optimization":
                await _run_optimization(websocket, document_id, data.get("content", ""), data.get("filename", ""))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[Editor WS] error: {e}")
    finally:
        if document_id in editor_connections:
            editor_connections[document_id].discard(websocket)
            if not editor_connections[document_id]:
                del editor_connections[document_id]
        task_key = f"{document_id}_{id(websocket)}"
        if task_key in _debounce_tasks:
            _debounce_tasks[task_key].cancel()
            _debounce_tasks.pop(task_key, None)


async def _handle_editor_edit(websocket: WebSocket, document_id: str, data: dict):
    content = data.get("content", "")
    filename = data.get("filename", "")

    await editor_broadcast(
        document_id,
        {"type": "edit", "content": content, "user_type": "human"},
        exclude=websocket,
    )

    task_key = f"{document_id}_{id(websocket)}"
    if task_key in _debounce_tasks:
        _debounce_tasks[task_key].cancel()

    async def debounced():
        try:
            await asyncio.sleep(DEBOUNCE_DELAY)
            await websocket.send_json({"type": "ai_status", "status": "analyzing"})
            await _run_ai_analysis(websocket, document_id, content, filename)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[Editor WS] analysis error: {e}")
        finally:
            _debounce_tasks.pop(task_key, None)

    _debounce_tasks[task_key] = asyncio.create_task(debounced())


async def _run_ai_analysis(websocket: WebSocket, document_id: str, content: str, filename: str = ""):
    try:
        ai = AIService()
        result = await ai.analyze_code(code=content, filename=filename)
        await websocket.send_json({
            "type": "ai_suggestion",
            "suggestion_data": {
                "suggestions": result.get("suggestions", []),
                "analysis": result.get("analysis", {}),
            },
            "timestamp": int(time.time() * 1000),
        })
    except Exception as e:
        logger.error(f"[Editor WS] AI analysis error: {e}")
        try:
            await websocket.send_json({"type": "ai_error", "message": str(e)})
        except Exception:
            pass


async def _run_optimization(websocket: WebSocket, document_id: str, content: str, filename: str = ""):
    try:
        await websocket.send_json({"type": "ai_status", "status": "optimizing"})
        ai = AIService()
        result = await ai.optimize_code(code=content, filename=filename)
        if "error" in result:
            await websocket.send_json({"type": "optimization_error", "message": result["error"]})
        else:
            await websocket.send_json({"type": "optimization_complete", "data": {"optimization": result}})
    except Exception as e:
        logger.error(f"[Editor WS] optimization error: {e}")


@router.get("/stats")
async def get_websocket_stats():
    yjs_manager = await YjsDocumentManager.get_instance()
    stats = yjs_manager.get_document_stats()
    return {
        "websocket_connections": {
            doc_id: manager.get_client_count(doc_id) for doc_id in manager.active_connections
        },
        "editor_connections": {doc_id: len(conns) for doc_id, conns in editor_connections.items()},
        **stats,
    }
