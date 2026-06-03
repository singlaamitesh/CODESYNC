"""
Analyze operation: find bugs / issues in code and suggest line-level fixes.

Pipeline: prepare -> call LLM -> finish.
The offline fallbacks (no API key, or LLM failed) live in the stages so a single
STOP cleanly ends the run with a valid result.
"""
import re
from typing import Optional

from app.modules.ai.pipeline.core import Pipeline, PipelineContext, STOP, call_llm_stage
from app.modules.ai.pipeline.infra import detect_language, is_executable_code, safe_json_parse


def _empty_analysis() -> dict:
    """Result for empty input — nothing to analyze."""
    return {
        "suggestions": [],
        "analysis": {"lines": 0, "functions": 0, "classes": 0, "complexity_score": 100},
        "language": "text",
        "llm_used": None,
    }


def _fallback_analysis(code: str, language: str) -> dict:
    """Rule-based analysis used when the LLM is unavailable.

    Currently only catches a couple of common Python mistakes; the point is to
    always return *something* useful rather than an error.
    """
    suggestions = []
    lines = code.split("\n")
    if language == "python":
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.endswith(";") and not stripped.startswith("#"):
                suggestions.append({
                    "type": "error", "message": "Unnecessary semicolon in Python",
                    "line": i + 1, "severity": "error", "fix": line.rstrip().rstrip(";"),
                })
            if "//" in line and not stripped.startswith("#"):
                suggestions.append({
                    "type": "error", "message": "Use # for comments in Python, not //",
                    "line": i + 1, "severity": "error",
                    "fix": re.sub(r"\s*//\s*", "  # ", line.rstrip()),
                })
    return {
        "suggestions": suggestions,
        "analysis": {
            "lines": len(lines), "functions": 0, "classes": 0,
            "complexity_score": max(0, 100 - len(suggestions) * 20),
        },
        "language": language,
        "llm_used": "fallback",
    }


async def _prepare(ctx: PipelineContext) -> Optional[str]:
    if not ctx.code or not ctx.code.strip():
        ctx.result = _empty_analysis()
        return STOP

    ctx.language = detect_language(ctx.code, ctx.filename)
    if not ctx.client.ready:
        ctx.result = _fallback_analysis(ctx.code, ctx.language)
        return STOP

    lines = ctx.code.split("\n")
    numbered = "\n".join(f"{i + 1}: {ln}" for i, ln in enumerate(lines))

    # Tell the LLM whether this is executable code or data, so it doesn't
    # "fix" a config/markup file as if it were a program.
    if is_executable_code(ctx.language):
        intent = f"Analyze this {ctx.language} source code. Find ALL bugs and report each with a fix."
    else:
        intent = (
            f"This is a {ctx.language} file (filename: {ctx.filename or 'unknown'}). "
            f"Validate its structure/syntax and report ONLY actual problems. "
            f"Do NOT invent code suggestions if the content is non-executable."
        )

    ctx.max_tokens, ctx.temperature = 1500, 0.1
    ctx.prompt = f"""{intent}

CODE:
{numbered}

Return JSON with this EXACT format:
{{"suggestions": [{{"type": "error/warning/info", "message": "description", "line": 1, "severity": "error/warning/info", "fix": "corrected line"}}], "analysis": {{"lines": 10, "functions": 2, "classes": 1, "complexity_score": 75}}}}

The "fix" field MUST be the complete replacement for the line at the given line number — same indentation, same number of lines (or use \\n for multi-line). If you have no high-confidence fix, omit the "fix" field.
If the file has no problems return {{"suggestions": [], "analysis": {{"lines": {len(lines)}, "functions": 0, "classes": 0, "complexity_score": 100}}}}.
Return ONLY valid JSON, no markdown."""
    return None


async def _finish(ctx: PipelineContext) -> Optional[str]:
    parsed = safe_json_parse(ctx.raw_response, None)
    if parsed is None:  # LLM failed or returned garbage -> rule-based fallback
        ctx.result = _fallback_analysis(ctx.code, ctx.language)
        return STOP
    parsed["language"] = ctx.language
    parsed["llm_used"] = ctx.model
    parsed.setdefault("analysis", {})["lines"] = len(ctx.code.split("\n"))
    ctx.result = parsed
    return None


def pipeline() -> Pipeline:
    return Pipeline(_prepare, call_llm_stage, _finish, name="analyze")
