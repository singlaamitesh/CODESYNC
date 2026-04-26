"""
Prompt assembly + streamed LLM call. The endpoint glues this onto SSE.
"""
from __future__ import annotations

import json
import logging
import os
from typing import AsyncGenerator, Dict, List, Optional

import httpx

# Workaround: respx==0.21.1's default httpcore-level mocker leaves request.method
# as bytes when wrapping httpx 0.28+ requests, which breaks Method('POST').match().
# Switch the global default to the httpx-level mocker so tests using @respx.mock
# match POST routes correctly. Production code is unaffected (no respx in prod).
try:  # pragma: no cover - only relevant in test env
    from respx import mocks as _respx_mocks  # type: ignore

    _respx_mocks.DEFAULT_MOCKER = "httpx"
except Exception:
    pass

logger = logging.getLogger(__name__)

OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")
OPEN_FILE_CAP = 8000   # characters
HISTORY_TURNS = 6
CHUNK_CHARS_CAP = 2000


def build_prompt(
    *,
    retrieved: List[Dict],
    open_file_content: Optional[str],
    open_file_name: Optional[str],
    history: List[Dict],
    new_message: str,
) -> str:
    parts: List[str] = []
    parts.append(
        "You are CodeSync's coding assistant. Answer concisely. "
        "When you produce code, use fenced code blocks with the language tag. "
        "Cite sources by [n] using the retrieved chunks below."
    )

    if retrieved:
        parts.append("\n--- RETRIEVED CHUNKS ---")
        for i, c in enumerate(retrieved, start=1):
            body = (c.get("content") or "")[:CHUNK_CHARS_CAP]
            parts.append(f"[{i}] document={c.get('document_id')} chunk={c.get('chunk_idx')}\n{body}")
    else:
        parts.append("\n--- RETRIEVED CHUNKS ---\n(none — workspace not yet indexed)")

    if open_file_content and open_file_name:
        parts.append(f"\n--- CURRENT FILE: {open_file_name} ---")
        parts.append(open_file_content[:OPEN_FILE_CAP])

    if history:
        parts.append("\n--- CONVERSATION ---")
        for turn in history[-HISTORY_TURNS:]:
            role = turn.get("role", "user").upper()
            parts.append(f"{role}: {turn.get('content','')}")

    parts.append(f"\nUSER: {new_message}\nASSISTANT:")
    return "\n".join(parts)


async def stream_chat(
    *, prompt: str, api_key: str, model: str,
    referer: str = "https://codesync.local", title: str = "CodeSync AI",
    timeout: float = 120.0,
) -> AsyncGenerator[str, None]:
    """Yield text deltas from OpenRouter's chat completions stream."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": title,
    }
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "max_tokens": 2048,
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", OPENROUTER_URL, headers=headers, json=body) as resp:
            if resp.status_code != 200:
                err = (await resp.aread()).decode("utf-8", errors="ignore")
                logger.warning(f"[chat] LLM {resp.status_code}: {err[:200]}")
                yield f"\n[error: model returned HTTP {resp.status_code}]"
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if payload == "[DONE]":
                    return
                try:
                    parsed = json.loads(payload)
                    delta = parsed["choices"][0].get("delta", {})
                    chunk = delta.get("content", "")
                    if chunk:
                        yield chunk
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
