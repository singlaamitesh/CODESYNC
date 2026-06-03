import pytest
import respx
from httpx import Response

from app.modules.chat.chat_stream import build_prompt, stream_chat


def test_build_prompt_includes_chunks_and_history():
    chunks = [
        {"document_id": "d1", "chunk_idx": 0, "content": "def login(): pass", "preview": "def login()"},
    ]
    history = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    prompt = build_prompt(
        retrieved=chunks,
        open_file_content="print(1)",
        open_file_name="main.py",
        history=history,
        new_message="explain login",
    )
    assert "def login(): pass" in prompt
    assert "main.py" in prompt
    assert "explain login" in prompt
    assert "user: hi" in prompt.lower() or "USER: hi" in prompt


def test_build_prompt_truncates_open_file():
    big = "x" * 50000
    prompt = build_prompt(retrieved=[], open_file_content=big, open_file_name="big.py", history=[], new_message="?")
    # 8KB cap on open file body
    assert prompt.count("x") <= 8200


@pytest.mark.asyncio
@respx.mock
async def test_stream_chat_yields_tokens():
    sse = b"data: {\"choices\":[{\"delta\":{\"content\":\"Hello \"}}]}\n\n" \
          b"data: {\"choices\":[{\"delta\":{\"content\":\"World\"}}]}\n\n" \
          b"data: [DONE]\n\n"
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, content=sse, headers={"content-type": "text/event-stream"})
    )

    chunks = []
    async for piece in stream_chat(prompt="x", api_key="k", model="m"):
        chunks.append(piece)
    assert "".join(chunks) == "Hello World"
