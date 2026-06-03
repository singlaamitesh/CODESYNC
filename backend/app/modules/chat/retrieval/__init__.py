"""Retrieval: document chunking + vector embeddings/search for RAG."""
from . import embeddings
from .chunking import chunk_text, Chunk

__all__ = ["embeddings", "chunk_text", "Chunk"]
