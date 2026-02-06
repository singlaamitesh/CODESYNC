#!/bin/bash

echo "========================================="
echo "🔍 CodeSync AI - System Verification"
echo "========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Checking $name... "
    response=$(curl -s "$url" 2>&1)
    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

echo "🌐 Service Health Checks:"
echo "----------------------------"

check_service "FastAPI Health" "http://127.0.0.1:8000/health" "healthy"
check_service "FastAPI Root" "http://127.0.0.1:8000/" "CodeSync AI"
check_service "Documents API" "http://127.0.0.1:8000/api/documents/" '"id"'

echo ""
echo "🤖 AI/LLM Integration Test:"
echo "----------------------------"

# Create test document
echo -n "Creating test document... "
TEST_DOC=$(curl -s -X POST http://127.0.0.1:8000/api/documents/ \
  -H "Content-Type: application/json" \
  -d '{
    "title": "verification_test.py",
    "content": "def test():\\n    x = 1;;\\n    print(x)",
    "language": "python"
  }')

DOC_ID=$(echo "$TEST_DOC" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -n "$DOC_ID" ]; then
    echo -e "${GREEN}✓ OK (ID: $DOC_ID)${NC}"
    
    echo -n "Running AI analysis... "
    AI_RESULT=$(curl -s -X POST "http://127.0.0.1:8000/api/ai/analyze/$DOC_ID")
    
    LLM_USED=$(echo "$AI_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['suggestion_data']['analysis'].get('llm_used', 'N/A'))" 2>/dev/null)
    SUGGESTIONS_COUNT=$(echo "$AI_RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data['suggestion_data']['suggestions']))" 2>/dev/null)
    
    if [ "$LLM_USED" = "arcee-ai/trinity-large-preview:free" ]; then
        echo -e "${GREEN}✓ OK${NC}"
        echo "   LLM Model: $LLM_USED"
        echo "   Suggestions Found: $SUGGESTIONS_COUNT"
    else
        echo -e "${YELLOW}⚠ Warning: Using fallback (LLM: $LLM_USED)${NC}"
    fi
    
    # Cleanup
    curl -s -X DELETE "http://127.0.0.1:8000/api/documents/$DOC_ID" > /dev/null
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""
echo "🔌 WebSocket Endpoints:"
echo "----------------------------"

echo -n "Y.js WebSocket (port 8001)... "
if lsof -i:8001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Listening${NC}"
else
    echo -e "${RED}✗ Not listening${NC}"
fi

echo -n "Editor WebSocket (port 8000)... "
if curl -s http://127.0.0.1:8000/ws/stats 2>&1 | grep -q "websocket"; then
    echo -e "${GREEN}✓ Available${NC}"
else
    echo -e "${YELLOW}⚠ Check manually${NC}"
fi

echo ""
echo "🗄️  Database Connection:"
echo "----------------------------"

echo -n "PostgreSQL... "
if psql -U amitesh -d codesync_db -c "SELECT COUNT(*) FROM documents;" > /dev/null 2>&1; then
    DOC_COUNT=$(psql -U amitesh -d codesync_db -t -c "SELECT COUNT(*) FROM documents;" 2>/dev/null | tr -d ' ')
    echo -e "${GREEN}✓ Connected ($DOC_COUNT documents)${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
fi

echo -n "Redis... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

echo ""
echo "📦 Frontend Status:"
echo "----------------------------"

echo -n "Vite Dev Server (port 8080)... "
if curl -s http://localhost:8080 2>&1 | grep -q "vite"; then
    echo -e "${GREEN}✓ Running${NC}"
elif lsof -i:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

echo ""
echo "========================================="
echo -e "${GREEN}✅ Verification Complete${NC}"
echo "========================================="
echo ""
echo "📍 Access Points:"
echo "   • Frontend:  http://localhost:8080"
echo "   • API:       http://localhost:8000"
echo "   • API Docs:  http://localhost:8000/docs"
echo ""
