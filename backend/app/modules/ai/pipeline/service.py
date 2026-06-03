"""
AIService facade.

The single public entry point for the rest of the app. It owns the shared
`OpenRouterClient` and runs each operation's pipeline, exposing the same method
names the routers and WebSocket handler have always called.

Layers (see folders): service (this file) -> operations/ -> core/ + infra/.
"""
from typing import Any, AsyncIterator, Dict, Optional

from .core import PipelineContext
from .infra import OpenRouterClient
from .operations import analyze, optimize, complete


class AIService:
    """Code analysis, optimization, and completion via the OpenRouter LLM."""

    def __init__(self):
        self.client = OpenRouterClient()

    # Convenience pass-throughs (used by routers for /config and fallbacks).
    @property
    def model(self) -> str:
        return self.client.model

    @property
    def ready(self) -> bool:
        return self.client.ready

    def _context(self, code: str, filename: Optional[str], **extras) -> PipelineContext:
        """Build a context pre-loaded with the shared client + model id."""
        return PipelineContext(
            code=code, filename=filename, extras=extras,
            client=self.client, model=self.client.model,
        )

    async def analyze_code(self, code: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """Find bugs / issues in `code` and suggest line-level fixes."""
        return await analyze.pipeline().run(self._context(code, filename))

    async def optimize_code(self, code: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """Rewrite `code` for performance/readability, with a change summary."""
        return await optimize.pipeline().run(self._context(code, filename))

    async def get_completions(
        self, code: str, line: int, column: int, filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """Suggest completions at the given cursor position."""
        return await complete.pipeline().run(
            self._context(code, filename, line=line, column=column)
        )

    # Streaming chat bypasses the JSON pipeline — it forwards raw text chunks.
    async def call_openrouter_stream(
        self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1
    ) -> AsyncIterator[str]:
        async for chunk in self.client.stream(prompt, max_tokens=max_tokens, temperature=temperature):
            yield chunk

    # Kept for any direct callers that want a one-shot completion.
    async def call_openrouter(
        self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1
    ) -> Optional[str]:
        return await self.client.complete(prompt, max_tokens=max_tokens, temperature=temperature)
