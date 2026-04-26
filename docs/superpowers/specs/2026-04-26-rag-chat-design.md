# Phase 1 — Codebase RAG Chat

**Date:** 2026-04-26
**Status:** Approved
**Part of:** Multi-phase AI-first roadmap (1 of 4: Phase 2 = inline ghost-text, Phase 3 = multi-file refactors, Phase 4 = autonomous agent)

## Goal

Add a **Cursor-style chat panel** that answers questions and produces code by retrieving relevant chunks from the user's files via LanceDB. Each thread is workspace-scoped and persists across sessions. Streaming responses, citations, and one-click "Apply at cursor" — all running on the existing $6 DigitalOcean droplet.

## Non-Goals

- Function-calling / tool-use (deferred to Phase 4)
- Diff preview before applying code (deferred to Phase 3)
- Image / voice input
- Cross-workspace search

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Right-side slide-out panel (Cmd+L toggle)               │
│  ── ThreadList                                           │
│  ── Streaming Markdown messages                          │
│  ── Code blocks with [Apply at cursor]                   │
└────────────────────────┬─────────────────────────────────┘
                         │ SSE (text/event-stream)
                         ▼
┌──────────────────────────────────────────────────────────┐
│  FastAPI  POST /api/ai/chat/stream                       │
│  1. Verify PocketBase JWT                                │
│  2. Embed query (Nemotron via OpenRouter)                │
│  3. Retrieve top-5 LanceDB chunks (workspace-filtered)   │
│  4. Assemble prompt: chunks + open-file + history        │
│  5. Stream Gemini-2.5-flash → SSE → client               │
│  6. On finish: persist assistant message via PB admin    │
└──────────────────────────────────────────────────────────┘
```

## Data Model

### New PocketBase collections (added in a follow-up migration `1714000000_rag_chat.js`)

- **`ai_chat_sessions`**
  - `workspace` (relation → workspaces, cascadeDelete)
  - `user` (relation → users, cascadeDelete)
  - `title` (text, max 255)
  - autodate `created`, `updated`
  - Rules: list/view/create/update/delete = `@request.auth.id != "" && user = @request.auth.id`
- **`ai_chat_messages`**
  - `session` (relation → ai_chat_sessions, cascadeDelete)
  - `role` (select: `user` | `assistant`)
  - `content` (text)
  - `citations` (json) — array of `{document_id, chunk_idx, score}`
  - autodate `created`
  - Rules: list/view = `@request.auth.id != "" && session.user = @request.auth.id`; create = same; no update; delete = same.

### LanceDB

Replace the current single-vector-per-document table with a chunk-level table:

| Column | Type | Notes |
|---|---|---|
| `id` | string (PK) | Format `<documentId>:<chunkIdx>` |
| `document` | string | PocketBase document id |
| `workspace` | string | PocketBase workspace id |
| `chunk_idx` | int | 0-based |
| `preview` | string | First ~200 chars of chunk for display |
| `content` | string | Full chunk text — used in the LLM prompt |
| `vector` | fixed_size_list&lt;f32&gt;[N] | N detected at table creation |

A new LanceDB table named `embeddings_chunks` is created on first chunk insertion. The existing `documents` LanceDB table (the per-document vectors written before this phase) is **dropped during the migration** to avoid drift between two indices.

## Chunking

- **Splitter** (in `app/services/chunking.py`):
  - Tokens estimated as `len(text.split()) * 1.3`
  - Window 500 tokens, overlap 50 tokens, by character indices computed from a whitespace cursor
  - Trims to whole-line boundaries when possible
- **Trigger:** existing `scheduleEmbed` in [editorStore.ts](codesync/code-harmony-main/src/stores/editorStore.ts) keeps its 10-second debounce. Server-side `embed_document` is rewritten to chunk + embed each chunk + upsert `(document, chunk_idx)` rows. Old chunks for the document are deleted first.

## API Surface (FastAPI)

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/api/ai/chat/stream` | PB JWT | Body `{session_id, content, current_file_id?, selection?}`. Returns SSE stream: events `token`, `citation`, `done`, `error`. Persists user message before streaming and assistant message at `done`. |

Session/message reads and create-thread happen via the **PocketBase JS SDK directly** from the frontend — no FastAPI proxy needed because PB row rules already enforce per-user access.

### SSE event format

```
event: citation
data: {"document_id":"...","chunk_idx":3,"preview":"def login(...)","score":0.91}

event: token
data: "Hello, "

event: token
data: "the login function..."

event: done
data: {"message_id":"abc123"}
```

## Prompt Assembly

```
You are CodeSync's coding assistant. Answer concisely. When you produce code,
use fenced blocks with the language tag. Cite sources by [n] using the
following retrieved chunks.

[1] {filename}:{startLine}-{endLine}
{chunk1.content}

[2] ...

CURRENT FILE: {filename}
{open_file_content[:8000]}

CONVERSATION:
{last 6 messages}

USER: {new message}
```

- Retrieved chunks: top-5 by cosine, filtered to current workspace.
- Open file content: only if `current_file_id` provided; capped at 8 KB.
- History: last 6 messages from the thread (3 turns).

## Frontend

```
src/components/ai-chat/
  AIChatPanel.tsx      # slide-out container, thread state, layout
  ThreadList.tsx       # left strip: list of sessions, "New chat" button
  MessageList.tsx      # scrollable transcript
  Message.tsx          # markdown + code blocks + citation chips
  CodeBlock.tsx        # syntax-highlighted code with [Apply at cursor]
  Composer.tsx         # textarea, Cmd+Enter to send

src/lib/
  aiChat.ts            # PocketBase queries + the SSE stream helper

src/hooks/
  useAIChat.ts         # main state machine (active session, streaming buffer)
```

- Panel slides in from the right. Width: 460px. Hidden by default; toggled with **Cmd+L** (Ctrl+L on Linux/Windows).
- "Apply at cursor" reuses `applyFixToEditor` from [editorStore.ts](codesync/code-harmony-main/src/stores/editorStore.ts) — inserts at the current Monaco cursor position via Y.js.
- Streaming uses `fetch` with `ReadableStream` rather than `EventSource` so we can pass the PocketBase JWT in the `Authorization` header.

## Resource Discipline (fits a 1 GB / 1 vCPU droplet)

- **Per-user concurrency:** in-memory dict `{user_id → asyncio.Semaphore(1)}`. Second concurrent stream returns HTTP 429. Cleared on stream finish.
- **Context cap:** 5 chunks × ≤ 2000 chars + open file ≤ 8 KB + history ≤ 4 KB → typical prompt ≤ 25 KB. Well under model limits.
- **No local models.** All embed/LLM traffic goes to OpenRouter.
- **LanceDB:** brute-force vector scan filtered by workspace; sub-millisecond at portfolio scale (< 5000 chunks).
- **Memory delta:** approximately +10 MB resident (chunk index in pyarrow) over current footprint.

## Failure Modes

| Failure | Behavior |
|---|---|
| Embeddings provider 429/5xx | Return error SSE event with code `embed_failed`. Frontend shows toast: "Search index unavailable, try again." |
| LLM 429/5xx | Same shape. Toast: "Model rate-limited, try a different model in settings." |
| LanceDB empty for workspace | Stream proceeds without retrieved chunks; prompt notes "no indexed files." |
| PB token expired mid-stream | FastAPI closes connection. Frontend's interceptor retries `pb.collection('users').authRefresh()` and lets the user resend manually. |
| Workspace deleted mid-stream | PB cascade-deletes sessions; frontend's PB realtime subscription updates the UI. |

## Testing

- **Backend unit tests** (`fastapi_backend/tests/test_chunking.py`): chunking returns expected windows; ASCII vs unicode; empty/short inputs return 0 or 1 chunk.
- **Backend integration test** (`tests/test_chat_stream.py`): mock OpenRouter, send a chat request, assert SSE events arrive in order and assistant message lands in PB.
- **Frontend manual smoke**: open chat, type a question about an indexed file, observe streaming + citations + apply.

## Migration / Rollout

1. Add `pocketbase/pb_migrations/1714000000_rag_chat.js` creating the two new collections.
2. On FastAPI startup, drop the legacy `documents` LanceDB table if present (one-shot migration step in `embeddings.py`).
3. Switch `embeddings.upsert_document` to chunk + insert into `embeddings_chunks`.
4. The frontend ships the chat panel directly — no feature flag (this is a portfolio project, not phased rollout to real users).

## Out of Scope (revisited)

These are not built in Phase 1, even if tempting:

- Streaming partial diffs of code blocks
- Multi-file edits from a single chat turn (Phase 3 territory)
- Tool-use / function calling (Phase 4)
- Voice or image input
- Cross-workspace search ("search all my projects")
- Server-side rate limiting beyond per-user concurrency
