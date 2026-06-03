#!/usr/bin/env bash
#
# run.sh — start CodeSync locally (PocketBase + FastAPI backend + Vite frontend).
#
# Each service runs in the background; PIDs and logs go to scripts/.run/ so
# stop.sh can shut them down cleanly. Re-running this script is safe: it stops
# anything already listening on the target ports first.
#
# Ports (override via env):
#   BACKEND_PORT   default 8003  (must match frontend's VITE_API_BASE_URL)
#   FRONTEND_PORT  default 8080
#   PB_PORT        default 8090
#
# Usage:  ./scripts/run.sh
#
set -euo pipefail

# --- paths ------------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/scripts/.run"
mkdir -p "$RUN_DIR"

BACKEND_PORT="${BACKEND_PORT:-8003}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PB_PORT="${PB_PORT:-8090}"

# --- helpers ----------------------------------------------------------------
log()  { printf '\033[1;34m[run]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[run]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[run]\033[0m %s\n' "$*" >&2; }

# Kill whatever is already on a port (so re-running is idempotent).
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    warn "port $port in use — stopping pid(s): $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

# Wait until an HTTP endpoint returns 200, or time out.
wait_for_http() {
  local url="$1" name="$2" tries="${3:-20}"
  for ((i = 1; i <= tries; i++)); do
    if curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null | grep -q 200; then
      log "$name is up ($url)"
      return 0
    fi
    sleep 1
  done
  warn "$name did not respond at $url after ${tries}s (check its log)"
  return 1
}

# --- 0. clean slate ---------------------------------------------------------
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

# --- 1. PocketBase (optional) ----------------------------------------------
# PocketBase ships only as a Dockerfile in this repo; a local binary is
# optional. If one is on PATH (or at pocketbase/pocketbase), start it;
# otherwise warn and continue — the backend degrades gracefully without it.
PB_BIN=""
if command -v pocketbase >/dev/null 2>&1; then
  PB_BIN="$(command -v pocketbase)"
elif [ -x "$ROOT/pocketbase/pocketbase" ]; then
  PB_BIN="$ROOT/pocketbase/pocketbase"
fi

if [ -n "$PB_BIN" ]; then
  free_port "$PB_PORT"
  log "starting PocketBase on :$PB_PORT"
  ( cd "$ROOT/pocketbase" && "$PB_BIN" serve --http "127.0.0.1:$PB_PORT" ) \
    > "$RUN_DIR/pocketbase.log" 2>&1 &
  echo $! > "$RUN_DIR/pocketbase.pid"
  wait_for_http "http://127.0.0.1:$PB_PORT/api/health" "PocketBase" 15 || true
else
  warn "PocketBase binary not found — skipping (auth/data features need it)."
  warn "  Install: https://pocketbase.io/docs/  or run via deploy/docker-compose.yml"
fi

# --- 2. Backend (FastAPI) ---------------------------------------------------
# Prefer the project venv's python if present, else system python3.
PY="python3"
if [ -x "$ROOT/backend/venv/bin/python" ]; then
  PY="$ROOT/backend/venv/bin/python"
fi

log "starting backend (FastAPI) on :$BACKEND_PORT  [python: $PY]"
( cd "$ROOT/backend" && exec "$PY" -m uvicorn main:app \
    --host 127.0.0.1 --port "$BACKEND_PORT" ) \
  > "$RUN_DIR/backend.log" 2>&1 &
echo $! > "$RUN_DIR/backend.pid"
wait_for_http "http://127.0.0.1:$BACKEND_PORT/health" "Backend" 25 || true

# --- 3. Frontend (Vite dev server) -----------------------------------------
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  warn "frontend/node_modules missing — running npm install (one time)…"
  ( cd "$ROOT/frontend" && npm install )
fi

log "starting frontend (Vite) on :$FRONTEND_PORT"
( cd "$ROOT/frontend" && exec npm run dev -- --port "$FRONTEND_PORT" --strictPort ) \
  > "$RUN_DIR/frontend.log" 2>&1 &
echo $! > "$RUN_DIR/frontend.pid"
wait_for_http "http://127.0.0.1:$FRONTEND_PORT/" "Frontend" 30 || true

# --- summary ----------------------------------------------------------------
echo
log "CodeSync is running:"
echo "    Frontend : http://localhost:$FRONTEND_PORT"
echo "    Backend  : http://127.0.0.1:$BACKEND_PORT  (health: /health)"
[ -n "$PB_BIN" ] && echo "    PocketBase: http://127.0.0.1:$PB_PORT/_/"
echo
echo "    Logs : $RUN_DIR/{backend,frontend,pocketbase}.log"
echo "    Stop : ./scripts/stop.sh"
