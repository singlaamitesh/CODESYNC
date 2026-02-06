#!/bin/bash

echo "========================================="
echo "🚀 Starting CodeSync AI Services"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/Volumes/Amitesh/System Design/CodeSync_AI"

# Check if Redis is running
echo -n "Checking Redis... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start Redis first: brew services start redis"
    exit 1
fi

# Check if PostgreSQL is running
echo -n "Checking PostgreSQL... "
if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start PostgreSQL first: brew services start postgresql@14"
    exit 1
fi

echo ""
echo "Starting services..."
echo ""

# 1. Start FastAPI Backend (port 8000)
echo -n "1️⃣  Starting FastAPI Backend (port 8000)... "
cd "$PROJECT_ROOT/fastapi_backend"
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/fastapi.log 2>&1 &
FASTAPI_PID=$!
sleep 3
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Started (PID: $FASTAPI_PID)${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Check logs: tail -f /tmp/fastapi.log"
    exit 1
fi

# 2. Start Y.js WebSocket Server (port 8001)
echo -n "2️⃣  Starting Y.js WebSocket Server (port 8001)... "
cd "$PROJECT_ROOT"
source venv/bin/activate
nohup python codesync/yjs_server.py > /tmp/yjs.log 2>&1 &
YJS_PID=$!
sleep 2
if lsof -i:8001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Started (PID: $YJS_PID)${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Check logs: tail -f /tmp/yjs.log"
    exit 1
fi

# 3. Start Frontend (port 8080)
echo -n "3️⃣  Starting Frontend Dev Server (port 8080)... "
cd "$PROJECT_ROOT/codesync/code-harmony-main"
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 4
if lsof -i:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Check logs: tail -f /tmp/frontend.log"
    exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo "========================================="
echo ""
echo "📍 Service URLs:"
echo "   • Frontend:       http://localhost:8080"
echo "   • FastAPI API:    http://localhost:8000"
echo "   • API Docs:       http://localhost:8000/docs"
echo "   • Y.js WebSocket: ws://localhost:8001"
echo ""
echo "📋 Process IDs:"
echo "   • FastAPI:  $FASTAPI_PID"
echo "   • Y.js:     $YJS_PID"
echo "   • Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   • FastAPI:  tail -f /tmp/fastapi.log"
echo "   • Y.js:     tail -f /tmp/yjs.log"
echo "   • Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop all services: ./stop.sh"
echo ""
echo "🤖 AI Model: arcee-ai/trinity-large-preview:free"
echo ""
