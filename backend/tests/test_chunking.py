from app.modules.chat.retrieval.chunking import chunk_text, Chunk


def test_short_text_one_chunk():
    chunks = chunk_text("hello world", target_tokens=500, overlap_tokens=50)
    assert len(chunks) == 1
    assert chunks[0].content == "hello world"
    assert chunks[0].chunk_idx == 0


def test_empty_text_no_chunks():
    assert chunk_text("", target_tokens=500, overlap_tokens=50) == []


def test_whitespace_only_no_chunks():
    assert chunk_text("   \n  \t  ", target_tokens=500, overlap_tokens=50) == []


def test_long_text_multiple_chunks_with_overlap():
    # 1500 word-ish tokens forces 3 chunks at target=500 with 50 overlap.
    text = "\n".join(f"line {i} word word word word word" for i in range(300))
    chunks = chunk_text(text, target_tokens=500, overlap_tokens=50)
    assert len(chunks) >= 3
    # Indices are 0, 1, 2, ...
    assert [c.chunk_idx for c in chunks] == list(range(len(chunks)))
    # Adjacent chunks share at least one line of content (overlap).
    for a, b in zip(chunks, chunks[1:]):
        a_tail = a.content.splitlines()[-1]
        assert a_tail in b.content


def test_chunk_preview_first_200_chars():
    text = "x" * 500
    chunks = chunk_text(text, target_tokens=500, overlap_tokens=50)
    assert len(chunks) == 1
    assert len(chunks[0].preview) <= 200
    assert chunks[0].preview == "x" * 200
