# PocketBase Migration + DigitalOcean $6 Droplet Deployment

**Date:** 2026-04-22
**Status:** Approved

## Goal

Replace OAuth + PostgreSQL with PocketBase (email/password auth + SQLite data layer), and deploy the entire stack on a single $6/month DigitalOcean droplet behind Caddy for a portfolio project.

## Scope (what changes)

- **Auth:** Google/GitHub OAuth replaced with PocketBase email/password.
- **Database:** PostgreSQL + SQLAlchemy replaced with PocketBase collections (SQLite).
- **Dropped services:** Redis (no pub/sub needed on a single node).
- **Deployment:** Netlify + Render replaced by one DO droplet running everything via Docker Compose + Caddy.
- **Data:** Fresh start — no migration. All users re-sign-up.

## Non-Goals

- OAuth providers (can be added later via PocketBase admin UI).
- Multi-instance horizontal scaling.
- Existing-user data migration.
- High-availability / failover.

## Architecture

Single droplet (Ubuntu 24.04, 1 GB RAM, 1 vCPU, 25 GB SSD). Docker Compose orchestrates four containers behind Caddy:

```
 Internet ──HTTPS──▶ Caddy (80/443)
                      ├─ /          → static React build (served from volume)
                      ├─ /api/*     → FastAPI :8000
                      ├─ /pb/*      → PocketBase :8090
                      └─ /ws/*      → FastAPI :8000 (Y.js + editor WS)
```

**Container sizing target:**

| Service     | Purpose                               | Est. RAM |
|-------------|---------------------------------------|----------|
| Caddy       | TLS, static files, reverse proxy      | ~30 MB   |
| PocketBase  | Auth + DB + realtime                  | ~40 MB   |
| FastAPI     | AI routes + Y.js CRDT WS              | ~150 MB  |
| OS + Docker | base                                  | ~300 MB  |
| **Total**   |                                       | ~520 MB  |

Leaves ~500 MB headroom.

## Data Model (PocketBase collections)

- **`users`** *(built-in auth collection)*
  - email, password, name, avatarUrl (email/password enabled)

- **`workspaces`**
  - name: text
  - owner: relation → users

- **`workspace_members`**
  - workspace: relation → workspaces
  - user: relation → users
  - role: select [owner, editor, viewer]

- **`folders`**
  - workspace: relation → workspaces
  - parent: relation → folders (nullable)
  - name: text

- **`documents`**
  - title, content (text), language, workspace (rel), folder (rel, nullable)

- **`chat_messages`**
  - workspace (rel), user (rel), content (text)

- **`embeddings`**
  - document (rel), vector (json)

**Access rules (simplified):** list/view/create/update/delete all gated on `@request.auth.id != "" && (record.owner = @request.auth.id || record.workspace.owner = @request.auth.id || @collection.workspace_members.user = @request.auth.id)` variants per collection. Exact rules live in the JSON migration.

Schema is shipped as `pocketbase/pb_migrations/1713720000_init.js` so a fresh PocketBase boot materializes all collections.

## FastAPI Changes

**Removed:**
- `routers/auth.py` (all OAuth flows, JWT creation, refresh)
- `routers/workspaces.py`, `routers/documents.py` (frontend talks to PocketBase directly)
- `services/redis_manager.py` and every `redis_manager` call
- `SessionLocal` usage from WebSocket save paths
- SQLAlchemy models for User, Workspace, Folder, Document, ChatMessage
- `services/yjs_manager.py` Redis pub/sub integration

**Kept (trimmed):**
- `routers/ai.py` — endpoints now accept `content` + `filename` in the POST body instead of loading from DB. No DB dependency.
- `routers/websocket.py` — Y.js CRDT endpoint and editor JSON endpoint. Chat WebSocket is removed; PocketBase realtime replaces it.
- `services/ai_service.py` — unchanged except `search_similar` reads embeddings from PocketBase via HTTP instead of Postgres (or the search endpoint is disabled for v1).

**New:**
- `services/pb_auth.py` — verifies PocketBase JWTs by calling `POST {PB_URL}/api/collections/users/auth-refresh` with the Bearer token. 60-second in-memory TTL cache keyed by token hash to avoid per-request round trips.
- `require_pb_auth` FastAPI dependency used by all `/api/ai/*` routes and the editor/Y.js WebSockets (token via `Authorization` header or `?token=` query param for WS).

**Keep existing `Embedding` storage** as a PocketBase collection; AI service writes/reads via PocketBase admin token (stored server-side as env var).

## Frontend Changes

**Added:**
- `pocketbase` npm package (official JS SDK).
- `src/lib/pb.ts` — shared PocketBase client instance (`new PocketBase('/pb')` in prod, `http://localhost:8090` in dev).

**Rewritten:**
- `stores/authStore.ts` — drops Zustand persistence; delegates to `pb.authStore` (PocketBase SDK auto-persists to localStorage). Exposes `user`, `isAuthenticated`, `login(email, password)`, `signup(email, password, name)`, `logout()`.
- `pages/Login.tsx` — replaces OAuth buttons with email/password form. Includes a "Create account" toggle.
- `lib/api.ts` — only AI + WebSocket-related functions remain; workspace/folder/document/chat calls move to the SDK.
- `components/sidebar/FileExplorer.tsx`, `components/sidebar/ChatPanel.tsx`, etc. — swap `apiService.*` calls for `pb.collection('...').*` calls.

**Removed:**
- `pages/AuthCallback.tsx` (no OAuth redirect)
- Route `/auth/callback/:provider` in `App.tsx`

**New pattern — chat realtime:**
```ts
pb.collection('chat_messages').subscribe('*', (e) => {
  if (e.record.workspace === currentWorkspaceId) append(e.record)
})
```
replaces the WebSocket chat connection.

## Deployment Artifacts (repo root)

- `deploy/docker-compose.yml`
- `deploy/Caddyfile`
- `deploy/.env.example`
- `deploy/README.md` — droplet setup steps
- `pocketbase/Dockerfile` (pulls official PocketBase binary)
- `pocketbase/pb_migrations/1713720000_init.js`
- `fastapi_backend/Dockerfile`
- `yjs-server/Dockerfile` *(only if we keep the Node Y.js server as a separate service — currently the FastAPI backend already implements Y.js protocol, so we skip this)*

## Auth Flow (new)

```
1. User opens https://codesync.example.com
2. Frontend loads, pb.authStore is empty → redirect to /login
3. User submits email/password → pb.collection('users').authWithPassword(...)
4. PocketBase validates, returns JWT, SDK stores it in localStorage
5. pb.authStore.isValid === true → app renders
6. All FastAPI /api/ai/* calls include Authorization: Bearer <pb-token>
7. FastAPI validates via pb.collection('users').authRefresh() (cached 60s)
```

## Non-Functional Concerns

- **Backups:** daily `cron` tar of `/var/pocketbase/pb_data` → `/var/backups/`, rotated weekly. DO Volume optional later.
- **HTTPS:** Caddy auto-issues via Let's Encrypt. Droplet must have DNS A record pointing to it.
- **Secrets:** `.env` on droplet only (not in git). `JWT_SECRET` is no longer needed; PocketBase handles its own.
- **AI API keys:** `OPENROUTER_API_KEY` (chat completions) and `EMBEDDINGS_API_KEY` (semantic search) live in the droplet `.env`.
- **Logging:** `docker compose logs -f` is enough for portfolio scale.

## Risks

1. **1 GB RAM tight:** a large AI call can spike memory. Mitigation: `MemoryLimit=200M` on FastAPI, upgrade to $12 plan if OOM becomes recurring.
2. **Semantic embedding search:** SQLite is slow for vector search; first version skips real vector indexing — the `/api/ai/search` endpoint returns top-N by simple cosine over PocketBase rows in Python. Fine for portfolio.
3. **Y.js persistence:** Y.js document state is held in-memory; if the FastAPI process restarts mid-edit, awareness is lost but document content is recovered because the frontend auto-saves to PocketBase on every edit. Acceptable.

## Out of scope for this migration

- Rate limiting, DDoS protection (Caddy defaults are OK).
- Monitoring dashboard.
- Email verification flow in PocketBase (can be enabled later in admin UI).
- Password reset flow (PocketBase supports it; wire up in a follow-up PR).
