"""
PipelineContext — the data bag passed through every stage of an AI operation.

Stages read the inputs (`code`, `filename`, ...) and progressively fill in
`language`, `prompt`, `raw_response`, `parsed`, and finally `result` (the value
returned to the caller). Keeping all per-run state in one object means stages
stay simple functions with no hidden coupling.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from app.modules.ai.pipeline.infra.client import OpenRouterClient


@dataclass
class PipelineContext:
    # --- inputs -------------------------------------------------------------
    code: str
    filename: Optional[str] = None
    extras: Dict[str, Any] = field(default_factory=dict)  # op-specific args (line/column...)

    # --- LLM call tuning (a prepare stage may override these) ---------------
    max_tokens: int = 2048
    temperature: float = 0.1

    # --- progressively filled by stages -------------------------------------
    language: str = "text"
    prompt: str = ""
    raw_response: Optional[str] = None
    parsed: Any = None
    result: Optional[Dict[str, Any]] = None

    # Shared client + model id, injected by the service facade.
    client: Optional[OpenRouterClient] = None
    model: Optional[str] = None
