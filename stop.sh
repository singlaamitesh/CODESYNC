#!/bin/bash

echo "========================================="
echo "🛑 Stopping CodeSync AI Services"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stop FastAPI
echo -n "Stopping FastAPI Backend... "
pkill -f "uvicorn main:app" && echo -e "${GREEN}✓ Stopped${NC}" || echo -e "${RED}✗ Not running${NC}"

# Stop Y.js Server
echo -n "Stopping Y.js WebSocket Server... "
pkill -f "yjs_server.py" && echo -e "${GREEN}✓ Stopped${NC}" || echo -e "${RED}✗ Not running${NC}"

# Stop Frontend
echo -n "Stopping Frontend Dev Server... "
pkill -f "vite" && echo -e "${GREEN}✓ Stopped${NC}" || echo -e "${RED}✗ Not running${NC}"

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""
