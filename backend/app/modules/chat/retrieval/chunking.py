"""
Pure-function text chunker. Splits source files into overlapping windows
sized to a target token count (estimated as words × 1.3). Tries to break on
line boundaries so chunks read naturally in the prompt.
"""
from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    chunk_idx: int
    content: str
    preview: str  # first 200 chars, for citation display


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, int(len(text.split()) * 1.3))


def chunk_text(text: str, target_tokens: int = 500, overlap_tokens: int = 50) -> List[Chunk]:
    if not text or not text.strip():
        return []

    lines = text.splitlines(keepends=True)
    if _estimate_tokens(text) <= target_tokens:
        content = text
        return [Chunk(chunk_idx=0, content=content, preview=content[:200])]

    chunks: List[Chunk] = []
    cursor = 0
    while cursor < len(lines):
        # Grow until we hit target_tokens.
        end = cursor
        running_tokens = 0
        while end < len(lines) and running_tokens < target_tokens:
            running_tokens += _estimate_tokens(lines[end])
            end += 1

        content = "".join(lines[cursor:end])
        chunks.append(Chunk(
            chunk_idx=len(chunks),
            content=content,
            preview=content[:200],
        ))

        if end >= len(lines):
            break

        # Step the cursor forward by (target - overlap) lines worth of tokens.
        retreat = 0
        retreat_tokens = 0
        idx = end - 1
        while idx >= cursor and retreat_tokens < overlap_tokens:
            retreat_tokens += _estimate_tokens(lines[idx])
            retreat += 1
            idx -= 1
        cursor = max(cursor + 1, end - retreat)

    return chunks
