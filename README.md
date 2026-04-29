# CodeSync AI — Real-time Collaborative Code Editor

A real-time collaborative code editor with AI-powered assistance. PocketBase
handles auth + storage; FastAPI handles AI + Y.js CRDT sync; Caddy serves the
React frontend. Designed to run on a single $6/month DigitalOcean droplet.

## Features

- Real-time multi-user editing with Y.js CRDTs (no merge conflicts)
- AI code analysis, optimization, and completions via OpenRouter
- Semantic search with LanceDB embedded vector store
- Email/password auth, workspaces, folders, documents, and chat
- Single-binary, single-droplet deployment

## Architecture

```
                ┌──────────────────────────────────────┐
 users ── HTTPS │  Caddy  (TLS, static, reverse proxy) │
                │   /         → React build            │
                │   /api/*    → FastAPI :8000          │
                │   /pb/*     → PocketBase :8090       │
                │   /ws/*     → FastAPI :8000          │
                └──────────────────────────────────────┘
```

- **PocketBase** — auth, SQLite DB, realtime subscriptions, admin UI.
- **FastAPI** — AI endpoints + Y.js CRDT WebSocket + LanceDB embeddings.
- **React + Monaco** — frontend served as static files by Caddy.

## Local development

### Prerequisites
- Python 3.12+
- Node.js 18+
- (No PostgreSQL or Redis required — PocketBase replaces both for this app.)

### 1. Run PocketBase

```bash
# Download the binary for your platform from https://pocketbase.io/docs/
# Or run via Docker:
docker run --rm -p 8090:8090 \
  -v "$(pwd)/pocketbase/pb_data:/pb/pb_data" \
  -v "$(pwd)/pocketbase/pb_migrations:/pb/pb_migrations:ro" \
  $(docker build -q ./pocketbase)
```

Open `http://127.0.0.1:8090/_/` and create the admin account on first boot.

### 2. Run the FastAPI backend

```bash
cd fastapi_backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Required env vars
export POCKETBASE_URL=http://127.0.0.1:8090
export OPENROUTER_API_KEY=sk-or-...      # for AI analyze/optimize/complete
# Embeddings (optional; enables /api/ai/search)
export EMBEDDINGS_API_KEY=sk-or-...
export LANCE_DIR="$(pwd)/.lance"

uvicorn main:app --reload --port 8000
```

### 3. Run the frontend

```bash
cd codesync/code-harmony-main
npm install
npm run dev   # http://localhost:8080
```

Vite proxies aren't configured in dev — set `VITE_API_BASE_URL` and
`VITE_PB_URL` in a `.env.local` if your services run on non-default ports.

## Production deployment

See [`deploy/README.md`](deploy/README.md) for the full droplet setup
(DigitalOcean $6 plan, Docker Compose, automatic HTTPS via Caddy).

## Project structure

```
CODESYNC/
├── deploy/                  # Droplet deployment (compose, Caddyfile, env, README)
├── pocketbase/              # PocketBase Dockerfile + schema migrations
├── fastapi_backend/         # FastAPI app (AI + Y.js)
│   ├── main.py
│   ├── requirements.txt
│   └── app/
│       ├── routers/         # ai.py, websocket.py
│       ├── services/        # ai_service.py, embeddings.py, pb_auth.py, yjs_manager.py
│       └── schemas.py
├── codesync/code-harmony-main/   # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/             # pb.ts, api.ts, workspace.ts
│   │   ├── pages/           # Login.tsx, Index.tsx
│   │   └── stores/
│   └── vite.config.ts
└── docs/superpowers/specs/  # Design specs
```

## AI integration

- **LLM:** any OpenRouter-served model (default: `mistralai/devstral-small:free`).
- **Embeddings:** any OpenAI-compatible `/embeddings` provider — defaults to
  OpenRouter's free `nvidia/llama-nemotron-embed-vl-1b-v2:free`.
- All AI routes require a valid PocketBase JWT (verified by FastAPI).

## License

MIT — see `LICENSE`.

## Author

Amitesh Gupta
