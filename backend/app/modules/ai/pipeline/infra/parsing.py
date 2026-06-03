"""
Tolerant JSON parsing for LLM output.

LLMs frequently wrap JSON in markdown fences or truncate the tail. This module
strips fences and attempts a few cheap repairs before giving up.
"""
import re
import json
from typing import Any


def safe_json_parse(text: str, default: Any = None) -> Any:
    """Parse JSON from possibly-messy LLM text, returning `default` on failure."""
    if not text:
        return default

    # 1. Strip a leading/trailing ```lang ... ``` markdown fence.
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    # 2. Happy path: it's already valid JSON.
    try:
        return json.loads(text)
    except Exception:
        pass

    # 3. Repair common truncation: close dangling braces/brackets and drop
    #    trailing commas, then try once more.
    text = text.rstrip().rstrip(",")
    text += "}" * max(0, text.count("{") - text.count("}"))
    text += "]" * max(0, text.count("[") - text.count("]"))
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    try:
        return json.loads(text)
    except Exception:
        return default
