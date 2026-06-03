"""Tests for the AI pipeline architecture (offline / fallback paths).

These run without an OpenRouter key: they verify the pipeline's stages, STOP
short-circuiting, and the fallback results are correct without any network call.
"""
import asyncio

from app.modules.ai import AIService
from app.modules.ai.pipeline.infra import detect_language, is_executable_code, safe_json_parse


def _offline_service() -> AIService:
    """An AIService whose client is not ready (forces fallback paths)."""
    svc = AIService()
    svc.client.ready = False
    return svc


# --- helper modules ----------------------------------------------------------

def test_detect_language_by_extension():
    assert detect_language("", "main.py") == "python"
    assert detect_language("", "app.tsx") == "typescript"
    # Unknown extension falls back to the bare extension.
    assert detect_language("", "messages.po") == "gettext-po"
    assert detect_language("", "weird.xyz") == "xyz"


def test_detect_language_by_content():
    assert detect_language("def foo():\n    pass") == "python"
    assert detect_language("const x = 1") == "javascript"


def test_is_executable_code():
    assert is_executable_code("python") is True
    assert is_executable_code("json") is False


def test_safe_json_parse_strips_fences_and_repairs():
    assert safe_json_parse('```json\n{"a": 1}\n```') == {"a": 1}
    # A dangling closing brace + trailing comma gets repaired.
    assert safe_json_parse('{"a": 1,}') == {"a": 1}
    # Unparseable input returns the supplied default.
    assert safe_json_parse("not json", default={}) == {}


# --- pipeline operations -----------------------------------------------------

def test_analyze_empty_returns_empty_analysis():
    res = asyncio.run(_offline_service().analyze_code("", "x.py"))
    assert res["suggestions"] == []
    assert res["llm_used"] is None


def test_analyze_fallback_catches_python_semicolon():
    res = asyncio.run(_offline_service().analyze_code("x = 1;\nprint(x)", "x.py"))
    assert res["llm_used"] == "fallback"
    assert any("semicolon" in s["message"] for s in res["suggestions"])
    assert res["analysis"]["lines"] == 2


def test_optimize_unconfigured_returns_error():
    res = asyncio.run(_offline_service().optimize_code("print(1)", "x.py"))
    assert res == {"error": "AI service not configured"}


def test_complete_unconfigured_returns_empty():
    res = asyncio.run(_offline_service().get_completions("def f(): pass", 1, 3, "x.py"))
    assert res == {"completions": [], "language": "python"}
