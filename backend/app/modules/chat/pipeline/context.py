"""
RagContext — data carried through the RAG pipeline stages.

Inputs (query, history, open file) are set by the router; stages progressively
fill `retrieved` -> `ranked` -> `prompt`. Generation streams separately (the
router consumes it), so the final LLM text is not stored here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class RagContext:
    # --- inputs -------------------------------------------------------------
    query: str
    workspace_id: str = ""
    history: List[Dict] = field(default_factory=list)
    open_file_name: Optional[str] = None
    open_file_content: Optional[str] = None

    # --- retrieval tuning ---------------------------------------------------
    top_k: int = 5
    # LanceDB returns a *distance* (lower = more similar). Chunks with a
    # distance strictly greater than this are dropped by the rerank stage.
    # None disables the threshold (keep everything retrieved).
    max_distance: Optional[float] = 1.0

    # --- progressively filled by stages -------------------------------------
    retrieved: List[Dict] = field(default_factory=list)  # raw search hits
    ranked: List[Dict] = field(default_factory=list)     # filtered + sorted
    prompt: str = ""
