#!/usr/bin/env bash
#
# stop.sh — stop the CodeSync services started by run.sh.
#
# Kills each tracked PID (scripts/.run/*.pid), then sweeps the known ports as a
# fallback in case a PID file is stale or a process was started another way.
#
# Usage:  ./scripts/stop.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/scripts/.run"

BACKEND_PORT="${BACKEND_PORT:-8003}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PB_PORT="${PB_PORT:-8090}"

log()  { printf '\033[1;34m[stop]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[stop]\033[0m %s\n' "$*"; }

# Kill a process tree by PID (the child npm/uvicorn spawn workers).
kill_tree() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  # children first, then the parent
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true
}

# 1. Stop tracked PIDs.
for svc in frontend backend pocketbase; do
  pidfile="$RUN_DIR/$svc.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      log "stopping $svc (pid $pid)"
      kill_tree "$pid"
    else
      warn "$svc not running (stale pid file)"
    fi
    rm -f "$pidfile"
  fi
done

# Give them a moment to exit, then hard-kill survivors by port.
sleep 1
for port in "$FRONTEND_PORT" "$BACKEND_PORT" "$PB_PORT"; do
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    warn "force-killing leftover on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done

log "all CodeSync services stopped."
