"""
Complete operation: suggest code completions at a cursor position.

Pipeline: prepare -> call LLM -> finish.
Cursor coordinates (line/column) arrive via `ctx.extras`.
"""
from typing import Optional

from app.modules.ai.pipeline.core import Pipeline, PipelineContext, STOP, call_llm_stage
from app.modules.ai.pipeline.infra import detect_language, safe_json_parse


async def _prepare(ctx: PipelineContext) -> Optional[str]:
    ctx.language = detect_language(ctx.code, ctx.filename) if ctx.code else "text"
    if not ctx.code or not ctx.client.ready:
        ctx.result = {"completions": [], "language": ctx.language}
        return STOP

    line = ctx.extras.get("line", 1)
    column = ctx.extras.get("column", 0)
    lines = ctx.code.split("\n")
    current_line = lines[line - 1] if line <= len(lines) else ""
    prefix = current_line[:column] if column <= len(current_line) else current_line

    ctx.max_tokens, ctx.temperature = 1024, 0.3
    ctx.prompt = f"""Provide code completions for {ctx.language} at cursor position.

Code:
```{ctx.language}
{ctx.code}
```

Current line: {current_line}
Cursor position: line {line}, column {column}
Prefix: "{prefix}"

Return JSON: {{"completions": [{{"label": "completion", "kind": "function/variable/keyword", "detail": "description"}}]}}"""
    return None


async def _finish(ctx: PipelineContext) -> Optional[str]:
    parsed = safe_json_parse(ctx.raw_response, {"completions": []})
    parsed["language"] = ctx.language
    ctx.result = parsed
    return None


def pipeline() -> Pipeline:
    return Pipeline(_prepare, call_llm_stage, _finish, name="complete")
