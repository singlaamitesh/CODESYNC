"""AI module: code analysis, optimization, and completion.

Public surface is `AIService` (the pipeline facade); the router wires it to
HTTP endpoints under /api/ai.
"""
from .pipeline.service import AIService

__all__ = ["AIService"]
