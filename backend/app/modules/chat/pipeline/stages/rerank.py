"""
Rerank stage: filter retrieved chunks by similarity, then order best-first.

The vector store returns a *distance* (`score`, lower = more similar), already
roughly ordered, but it returns the raw top-K regardless of how weak the match
is. This stage:

  1. Drops chunks whose distance exceeds `ctx.max_distance` (too dissimilar to
     be useful) — prevents stuffing the prompt with irrelevant context.
  2. Re-sorts the survivors by distance ascending, so the most relevant chunk
     is cited as [1].

Keeping this as its own stage makes the relevance policy easy to find and tune
(or to swap for a cross-encoder reranker later) without touching retrieval.
"""
from ..context import RagContext


def filter_and_rank(chunks: list[dict], max_distance: float | None) -> list[dict]:
    """Pure helper: drop chunks above the distance threshold, sort best-first."""
    kept = [c for c in chunks if max_distance is None or c.get("score", 0.0) <= max_distance]
    return sorted(kept, key=lambda c: c.get("score", 0.0))


async def rerank(ctx: RagContext) -> None:
    ctx.ranked = filter_and_rank(ctx.retrieved, ctx.max_distance)
