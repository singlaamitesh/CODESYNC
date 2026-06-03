"""Infrastructure: outbound I/O and low-level helpers.

These modules talk to the outside world (HTTP) or do pure text utilities, and
have no knowledge of the pipeline.
"""
from .client import OpenRouterClient
from .language import detect_language, is_executable_code
from .parsing import safe_json_parse

__all__ = ["OpenRouterClient", "detect_language", "is_executable_code", "safe_json_parse"]
