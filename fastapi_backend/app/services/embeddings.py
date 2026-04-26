"""
LanceDB-backed semantic index. Stores chunk-level embeddings for documents.
On first call, drops the legacy `documents` table (per-document vectors)
to avoid drift, then writes everything into `embeddings_chunks`.
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import List, Optional

import httpx

from app.services.chunking import chunk_text, Chunk

logger = logging.getLogger(__name__)

LANCE_DIR = Path(os.getenv("LANCE_DIR", "/var/lance"))

EMBEDDINGS_API_KEY = (
    os.getenv("EMBEDDINGS_API_KEY")
    or os.getenv("OPENROUTER_API_KEY")
    or os.getenv("OPENAI_API_KEY", "")
)
EMBEDDINGS_BASE_URL = os.getenv(
    "EMBEDDINGS_BASE_URL",
    os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"),
).rstrip("/")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nvidia/llama-nemotron-embed-vl-1b-v2:free")

CHUNK_TABLE = "embeddings_chunks"
LEGACY_TABLE = "documents"

_lock = asyncio.Lock()
_table = None
_table_dims: Optional[int] = None
_legacy_dropped = False
_lance_unavailable = False


def _load_lance():
    global _lance_unavailable
    if _lance_unavailable:
        return None, None
    try:
        import lancedb
        import pyarrow as pa
        return lancedb, pa
    except ImportError as e:
        logger.warning(f"[Lance] not installed; semantic search disabled ({e})")
        _lance_unavailable = True
        return None, None


async def _open_or_create_table(dims: int):
    global _table, _table_dims, _legacy_dropped
    if _table is not None:
        return _table

    lancedb, pa = _load_lance()
    if lancedb is None:
        return None
    LANCE_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCE_DIR))

    if not _legacy_dropped:
        try:
            if LEGACY_TABLE in db.table_names():
                db.drop_table(LEGACY_TABLE)
                logger.info("[Lance] dropped legacy `documents` table")
        except Exception as e:
            logger.warning(f"[Lance] could not drop legacy table: {e}")
        _legacy_dropped = True

    if CHUNK_TABLE in db.table_names():
        _table = db.open_table(CHUNK_TABLE)
        for f in _table.schema:
            if f.name == "vector" and hasattr(f.type, "list_size"):
                _table_dims = f.type.list_size
                break
        return _table

    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("document", pa.string()),
        pa.field("workspace", pa.string()),
        pa.field("chunk_idx", pa.int32()),
        pa.field("preview", pa.string()),
        pa.field("content", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), dims)),
    ])
    _table = db.create_table(CHUNK_TABLE, schema=schema, mode="create")
    _table_dims = dims
    logger.info(f"[Lance] created `{CHUNK_TABLE}` with vector dim {dims}")
    return _table


async def embed_text(text: str) -> Optional[List[float]]:
    if not EMBEDDINGS_API_KEY or not text.strip():
        return None

    payload = {"model": EMBEDDING_MODEL, "input": text[:8000]}
    headers = {
        "Authorization": f"Bearer {EMBEDDINGS_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("FRONTEND_URL", "https://codesync.local"),
        "X-Title": "CodeSync AI",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{EMBEDDINGS_BASE_URL}/embeddings",
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.warning(f"[Lance] embedding transport error: {e}")
        return None

    if resp.status_code != 200:
        logger.warning(f"[Lance] embedding API {resp.status_code}: {resp.text[:200]}")
        return None

    data = resp.json().get("data") or []
    if not data:
        return None
    vector = data[0].get("embedding")
    return vector if isinstance(vector, list) else None


async def upsert_document(*, document_id: str, workspace_id: str, title: str, content: str, updated: str) -> bool:
    """Re-chunk + re-embed a document. Old chunks are deleted first."""
    if not document_id:
        return False
    chunks: List[Chunk] = chunk_text(f"{title}\n\n{content}")
    if not chunks:
        return False

    rows = []
    for ch in chunks:
        vector = await embed_text(ch.content)
        if vector is None:
            return False
        rows.append({
            "id": f"{document_id}:{ch.chunk_idx}",
            "document": document_id,
            "workspace": workspace_id or "",
            "chunk_idx": ch.chunk_idx,
            "preview": ch.preview,
            "content": ch.content,
            "vector": vector,
        })

    async with _lock:
        table = await _open_or_create_table(len(rows[0]["vector"]))
        if table is None:
            return False
        if _table_dims is not None and _table_dims != len(rows[0]["vector"]):
            logger.error(f"[Lance] dim mismatch table={_table_dims} new={len(rows[0]['vector'])}")
            return False
        table.delete(f"document = '{document_id}'")
        table.add(rows)
    return True


async def delete_document(document_id: str) -> None:
    if not document_id:
        return
    async with _lock:
        if _table is None:
            return
        _table.delete(f"document = '{document_id}'")


async def search(query: str, workspace_id: Optional[str] = None, limit: int = 5) -> List[dict]:
    """Return top-N matching chunks for the query, scoped to a workspace."""
    vector = await embed_text(query)
    if vector is None:
        return []
    async with _lock:
        if _table is None and not (LANCE_DIR / f"{CHUNK_TABLE}.lance").exists():
            return []
        table = await _open_or_create_table(len(vector))
        if table is None:
            return []
        if _table_dims is not None and _table_dims != len(vector):
            return []
        q = table.search(vector).limit(limit)
        if workspace_id:
            q = q.where(f"workspace = '{workspace_id}'")
        df = q.to_pandas()
    out: List[dict] = []
    for _, row in df.iterrows():
        out.append({
            "id": row["id"],
            "document_id": row["document"],
            "chunk_idx": int(row["chunk_idx"]),
            "preview": row.get("preview", ""),
            "content": row.get("content", ""),
            "score": float(row.get("_distance", 0.0)),
        })
    return out
