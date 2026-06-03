"""
RAG pipeline engine.

Runs an ordered list of async `Stage`s over a `RagContext`. Mirrors the AI
module's pipeline so both read the same way. Stages mutate the context in
place; there is no STOP sentinel here because every RAG stage always runs
(an empty retrieval simply flows through as "no context").
"""
from __future__ import annotations

import logging
from typing import Awaitable, Callable, List

from .context import RagContext

logger = logging.getLogger(__name__)

# A Stage is an async function that mutates the context.
Stage = Callable[[RagContext], Awaitable[None]]


class RagPipeline:
    """Runs retrieval -> rerank -> prompt stages over a RagContext."""

    def __init__(self, *stages: Stage, name: str = "rag"):
        self.stages = stages
        self.name = name

    async def run(self, ctx: RagContext) -> RagContext:
        for stage in self.stages:
            await stage(ctx)
            logger.debug("[rag] '%s' ran %s", self.name, stage.__name__)
        return ctx
