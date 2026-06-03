"""
Prompt stage: assemble the final LLM prompt from the reranked chunks, the open
file, and recent conversation history. Delegates to the existing `build_prompt`
so the wording/format stays in one place.
"""
from app.modules.chat.chat_stream import build_prompt
from ..context import RagContext


async def build(ctx: RagContext) -> None:
    ctx.prompt = build_prompt(
        retrieved=ctx.ranked,
        open_file_content=ctx.open_file_content,
        open_file_name=ctx.open_file_name,
        history=ctx.history,
        new_message=ctx.query,
    )
