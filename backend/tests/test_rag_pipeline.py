"""Tests for the RAG pipeline: rerank/threshold logic + full prepare() flow.

Vector search is stubbed so no LanceDB/embeddings backend is required.
"""
import asyncio

from app.modules.chat.pipeline import RagContext, prepare
from app.modules.chat.pipeline.stages.rerank import filter_and_rank


# --- rerank/threshold (pure helper) -----------------------------------------

def test_filter_drops_chunks_above_distance_threshold():
    chunks = [
        {"id": "a", "score": 0.2},
        {"id": "b", "score": 0.9},   # above threshold -> dropped
        {"id": "c", "score": 0.5},
    ]
    kept = filter_and_rank(chunks, max_distance=0.6)
    assert [c["id"] for c in kept] == ["a", "c"]  # b dropped, sorted best-first


def test_filter_sorts_best_first_by_distance():
    chunks = [{"id": "x", "score": 0.8}, {"id": "y", "score": 0.1}, {"id": "z", "score": 0.4}]
    kept = filter_and_rank(chunks, max_distance=None)  # threshold disabled
    assert [c["id"] for c in kept] == ["y", "z", "x"]


def test_filter_none_threshold_keeps_all():
    chunks = [{"id": "a", "score": 5.0}, {"id": "b", "score": 0.0}]
    assert len(filter_and_rank(chunks, max_distance=None)) == 2


# --- full prepare() pipeline (retrieval stubbed) ----------------------------

def _stub_search(monkeypatch, hits):
    """Patch embeddings.search at its source module (the retrieve stage holds a
    reference to this module, so patching the attribute here takes effect)."""
    from app.modules.chat.retrieval import embeddings

    async def fake_search(query, workspace_id=None, limit=5):
        return hits

    monkeypatch.setattr(embeddings, "search", fake_search)


def test_prepare_filters_then_builds_prompt(monkeypatch):
    _stub_search(monkeypatch, [
        {"document_id": "d1", "chunk_idx": 0, "preview": "p", "content": "good ctx", "score": 0.1},
        {"document_id": "d2", "chunk_idx": 1, "preview": "p", "content": "weak ctx", "score": 0.95},
    ])
    ctx = asyncio.run(prepare(RagContext(query="how does login work?", workspace_id="w1", max_distance=0.6)))

    # Only the relevant chunk survives, and it's in the prompt.
    assert [c["document_id"] for c in ctx.ranked] == ["d1"]
    assert "good ctx" in ctx.prompt
    assert "weak ctx" not in ctx.prompt
    assert "how does login work?" in ctx.prompt


def test_prepare_with_no_hits_still_builds_prompt(monkeypatch):
    _stub_search(monkeypatch, [])
    ctx = asyncio.run(prepare(RagContext(query="anything")))
    assert ctx.ranked == []
    # build_prompt emits a "(none — workspace not yet indexed)" marker.
    assert "RETRIEVED CHUNKS" in ctx.prompt
