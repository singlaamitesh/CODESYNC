"""Chat module: RAG-backed streaming chat over the user's indexed documents.

Exposes prompt building + streaming, with retrieval (chunking + embeddings)
in the `retrieval` subpackage.
"""
from .chat_stream import build_prompt, stream_chat
from . import retrieval

__all__ = ["build_prompt", "stream_chat", "retrieval"]
