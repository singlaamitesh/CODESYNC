"""
Optimize operation: rewrite code for performance/readability with a change summary.

Pipeline: prepare -> call LLM -> finish.
"""
from typing import Optional

from app.modules.ai.pipeline.core import Pipeline, PipelineContext, STOP, call_llm_stage
from app.modules.ai.pipeline.infra import detect_language, safe_json_parse


async def _prepare(ctx: PipelineContext) -> Optional[str]:
    if not ctx.code:
        ctx.result = {"error": "No code provided"}
        return STOP
    ctx.language = detect_language(ctx.code, ctx.filename)
    if not ctx.client.ready:
        ctx.result = {"error": "AI service not configured"}
        return STOP

    ctx.max_tokens, ctx.temperature = 4096, 0.2
    ctx.prompt = f"""Optimize this {ctx.language} code. Return ONLY JSON:

```{ctx.language}
{ctx.code}
```

JSON format: {{"optimized_code": "code here", "changes": [{{"description": "change", "impact": "performance/readability"}}], "summary": "summary text"}}"""
    return None


async def _finish(ctx: PipelineContext) -> Optional[str]:
    parsed = safe_json_parse(ctx.raw_response, None)
    if not parsed or "optimized_code" not in parsed:
        ctx.result = {"error": "Failed to parse optimization"}
        return STOP
    parsed["language"] = ctx.language
    parsed["llm_used"] = ctx.model
    ctx.result = parsed
    return None


def pipeline() -> Pipeline:
    return Pipeline(_prepare, call_llm_stage, _finish, name="optimize")
