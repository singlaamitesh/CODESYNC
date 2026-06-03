"""
POST /api/ai/chat/stream — embed query, retrieve top-K chunks, stream LLM,
persist the assistant message back into PocketBase.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.modules.chat import stream_chat
from app.modules.chat.pipeline import RagContext, prepare
from app.modules.auth.pb_auth import (
    PB_URL, get_pb_admin_token, require_pb_auth, PbUser,
)

logger = logging.getLogger(__name__)
router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://codesync.local")

# Per-user concurrency lock — one in-flight chat stream per user.
_user_locks: defaultdict[str, asyncio.Semaphore] = defaultdict(lambda: asyncio.Semaphore(1))


class ChatStreamRequest(BaseModel):
    session_id: str
    content: str
    current_file_id: Optional[str] = None
    current_file_name: Optional[str] = None
    current_file_content: Optional[str] = None


async def _pb_get(path: str, token: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.get(f"{PB_URL}{path}", headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()


async def _pb_post(path: str, token: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as c:
        r = await c.post(
            f"{PB_URL}{path}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
        )
        r.raise_for_status()
        return r.json()


def _sse(event: str, data) -> bytes:
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


@router.post("/chat/stream")
async def chat_stream(
    req: ChatStreamRequest,
    user: PbUser = Depends(require_pb_auth),
):
    sem = _user_locks[user.id]
    if sem.locked():
        raise HTTPException(status_code=429, detail="Another stream is in flight for this user")

    admin_token = await get_pb_admin_token()
    if not admin_token:
        raise HTTPException(status_code=503, detail="PB admin not configured")

    # Hydrate session + history + verify ownership.
    session = await _pb_get(f"/api/collections/ai_chat_sessions/records/{req.session_id}", admin_token)
    if session.get("user") != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    workspace_id = session.get("workspace", "")

    msgs_resp = await _pb_get(
        f"/api/collections/ai_chat_messages/records?filter=session='{req.session_id}'&sort=created&perPage=200",
        admin_token,
    )
    history = [{"role": m["role"], "content": m["content"]} for m in msgs_resp.get("items", [])]

    # Persist the user turn before streaming.
    await _pb_post("/api/collections/ai_chat_messages/records", admin_token, {
        "session": req.session_id,
        "role": "user",
        "content": req.content,
    })

    async def generator():
        await sem.acquire()
        try:
            # Run the RAG prep pipeline: retrieve -> rerank/threshold -> prompt.
            ctx = await prepare(RagContext(
                query=req.content,
                workspace_id=workspace_id,
                history=history,
                open_file_name=req.current_file_name,
                open_file_content=req.current_file_content,
            ))

            # Cite only the chunks that survived reranking (most relevant first).
            for i, c in enumerate(ctx.ranked, start=1):
                yield _sse("citation", {
                    "n": i,
                    "document_id": c["document_id"],
                    "chunk_idx": c["chunk_idx"],
                    "preview": c["preview"],
                    "score": c["score"],
                })

            assistant = []
            async for piece in stream_chat(
                prompt=ctx.prompt,
                api_key=OPENROUTER_API_KEY,
                model=OPENROUTER_MODEL,
                referer=FRONTEND_URL,
            ):
                assistant.append(piece)
                yield _sse("token", piece)

            full = "".join(assistant)
            persisted = await _pb_post(
                "/api/collections/ai_chat_messages/records",
                admin_token,
                {
                    "session": req.session_id,
                    "role": "assistant",
                    "content": full,
                    "citations": [
                        {"document_id": c["document_id"], "chunk_idx": c["chunk_idx"], "score": c["score"]}
                        for c in ctx.ranked
                    ],
                },
            )
            yield _sse("done", {"message_id": persisted.get("id", "")})
        except Exception as e:
            logger.exception("[chat] stream error")
            yield _sse("error", {"message": str(e)})
        finally:
            sem.release()

    return StreamingResponse(generator(), media_type="text/event-stream")
