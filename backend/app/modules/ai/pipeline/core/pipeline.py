"""
Pipeline engine.

A `Pipeline` runs an ordered list of `Stage`s over a `PipelineContext`. Any
stage may halt the run early by returning `STOP` (after setting `ctx.result`),
which is how operations short-circuit when the LLM is unavailable.

This module is operation-agnostic: it knows nothing about analyze/optimize/etc.
"""
from __future__ import annotations

import logging
from typing import Awaitable, Callable, Dict, Optional

from .context import PipelineContext

logger = logging.getLogger(__name__)

# Sentinel a stage returns to halt the pipeline early (result is already set).
STOP = "STOP"

# A Stage is an async function that mutates the context and optionally returns
# STOP to end the run.
Stage = Callable[[PipelineContext], Awaitable[Optional[str]]]


class Pipeline:
    """Runs an ordered list of stages over a context."""

    def __init__(self, *stages: Stage, name: str = "ai"):
        self.stages = stages
        self.name = name

    async def run(self, ctx: PipelineContext) -> Dict:
        for stage in self.stages:
            if await stage(ctx) == STOP:
                logger.debug("[AI] pipeline '%s' short-circuited at %s", self.name, stage.__name__)
                break
        # A well-formed operation always sets ctx.result; guard just in case.
        return ctx.result if ctx.result is not None else {}
