"""Pipeline package: the staged engine behind every AI operation.

Layers: service (facade) -> operations/ -> core/ (engine) + infra/ (I/O).
"""
from .service import AIService

__all__ = ["AIService"]
