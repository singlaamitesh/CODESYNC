"""
Reusable stages shared by every operation.

Operation-specific stages (prepare/finish) live next to their operation in
`operations/`; only the generic ones live here.
"""
from typing import Optional

from .context import PipelineContext


async def call_llm_stage(ctx: PipelineContext) -> Optional[str]:
    """Send `ctx.prompt` to the LLM and store the text in `ctx.raw_response`."""
    ctx.raw_response = await ctx.client.complete(
        ctx.prompt, max_tokens=ctx.max_tokens, temperature=ctx.temperature
    )
    return None
