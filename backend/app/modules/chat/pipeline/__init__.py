"""RAG pipeline: retrieve -> rerank -> prompt, then stream generation.

The router builds a `RagContext`, calls `prepare()` to run the retrieval/rerank/
prompt stages, then streams the answer with `stream_chat` (generation is kept
separate because it yields tokens to the SSE response).
"""
from .context import RagContext
from .pipeline import RagPipeline
from .stages import retrieve, rerank, build_prompt_stage

# The ordered prep pipeline: everything up to (but not including) generation.
_PREP = RagPipeline(retrieve, rerank, build_prompt_stage, name="rag-prep")


async def prepare(ctx: RagContext) -> RagContext:
    """Run retrieve -> rerank -> build-prompt, returning the filled context."""
    return await _PREP.run(ctx)


__all__ = ["RagContext", "RagPipeline", "prepare"]
