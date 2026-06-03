"""
OpenRouter HTTP client.

This is the only module that talks to the network. Everything else in the
`ai` package is pure data transformation, which keeps the pipeline stages easy
to unit-test (they never make a real HTTP call).
"""
import os
import json
import logging
from typing import AsyncIterator, List, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# --- OpenRouter configuration (all overridable via .env) ---------------------
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")

# Sent on every request so OpenRouter can attribute traffic to this app.
_APP_HEADERS = {
    "HTTP-Referer": "http://localhost:8080",
    "X-Title": "CodeSync AI",
}


class OpenRouterClient:
    """Thin async wrapper around the OpenRouter chat-completions endpoint."""

    def __init__(self, api_key: str = OPENROUTER_API_KEY, model: str = OPENROUTER_MODEL):
        self.api_key = api_key
        self.model = model
        # `ready` is False when no API key is configured; callers fall back to
        # offline/rule-based behaviour instead of making a doomed request.
        self.ready = bool(api_key)
        if self.ready:
            logger.info("[AI] OpenRouter configured with model: %s", self.model)
        else:
            logger.warning("[AI] No OPENROUTER_API_KEY found in environment")

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **_APP_HEADERS,
        }

    def _payload(self, prompt: str, max_tokens: int, temperature: float, stream: bool) -> Dict:
        return {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream,
        }

    async def complete(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1) -> Optional[str]:
        """Return the full completion text, or None on any failure."""
        if not self.ready:
            return None
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    OPENROUTER_URL,
                    headers=self._headers(),
                    json=self._payload(prompt, max_tokens, temperature, stream=False),
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # network, auth, malformed body -> treat as "no answer"
            logger.error("[AI] OpenRouter API error: %s", exc)
            return None

    async def stream(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1) -> AsyncIterator[str]:
        """Yield completion text chunks as they arrive (Server-Sent Events)."""
        if not self.ready:
            return
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_URL,
                    headers=self._headers(),
                    json=self._payload(prompt, max_tokens, temperature, stream=True),
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        # OpenRouter streams SSE lines prefixed with "data: ".
                        if not line.startswith("data: "):
                            continue
                        chunk = line[6:]
                        if chunk == "[DONE]":
                            return
                        try:
                            delta = json.loads(chunk)["choices"][0].get("delta", {})
                            if content := delta.get("content"):
                                yield content
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue  # skip keep-alive / malformed frames
        except Exception as exc:
            logger.error("[AI] OpenRouter stream error: %s", exc)
