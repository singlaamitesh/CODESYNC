#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "  🧪 Multi-User Collaboration Test"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if services are running
echo "🔍 Checking services..."
if ! lsof -i:8000 > /dev/null 2>&1; then
    echo "❌ FastAPI not running on port 8000"
    echo "Run: ./start.sh"
    exit 1
fi

if ! lsof -i:8001 > /dev/null 2>&1; then
    echo "❌ Y.js WebSocket not running on port 8001"
    echo "Run: ./start.sh"
    exit 1
fi

if ! lsof -i:8080 > /dev/null 2>&1; then
    echo "❌ Frontend not running on port 8080"
    echo "Run: ./start.sh"
    exit 1
fi

echo "✅ All services running!"
echo ""

# Get local IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

echo "════════════════════════════════════════════════════════"
echo "  📱 Access URLs"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Local (this computer):"
echo "   http://localhost:8080"
echo ""
echo "Network (other devices):"
echo "   http://$LOCAL_IP:8080"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  🎯 Testing Steps"
echo "════════════════════════════════════════════════════════"
echo ""
echo "OPTION 1: Two Browser Windows (Recommended)"
echo "   1. Open http://localhost:8080 in Chrome"
echo "   2. Open http://localhost:8080 in Safari"
echo "   3. Create/open the SAME document in both"
echo "   4. Type in one window → see it in the other!"
echo ""

echo "OPTION 2: Two Tabs in Same Browser"
echo "   1. Open http://localhost:8080 in Tab 1"
echo "   2. Open http://localhost:8080 in Tab 2"
echo "   3. Open the same document in both tabs"
echo "   4. Edit in one tab → updates in the other"
echo ""

echo "OPTION 3: Incognito Mode"
echo "   1. Open http://localhost:8080 normally"
echo "   2. Open http://localhost:8080 in Incognito"
echo "   3. Open same document in both"
echo "   4. See real-time collaboration"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  🎨 What You'll See"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Each user gets:"
echo "   • Unique colored cursor"
echo "   • Random username (e.g., SwiftCoder42)"
echo "   • Real-time sync (< 50ms latency)"
echo "   • Automatic conflict resolution"
echo ""
echo "In the UI:"
echo "   • Top bar shows: 'Connected Users: 2'"
echo "   • Status indicator shows: 'Connected'"
echo "   • See other users' cursors in the editor"
echo ""

echo "════════════════════════════════════════════════════════"
echo "  🔍 Monitoring"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Watch Y.js WebSocket activity:"
echo "   $ tail -f /tmp/yjs.log"
echo ""
echo "Check active connections:"
echo "   $ lsof -i:8001"
echo ""
echo "View WebSocket stats:"
echo "   $ curl http://localhost:8000/ws/stats"
echo ""

echo "════════════════════════════════════════════════════════"
echo ""
echo "🚀 Ready to test! Open the URLs above in multiple browsers."
echo ""
echo "Press Ctrl+C when done testing"
echo ""
echo "════════════════════════════════════════════════════════"
echo ""

# Optional: Open in default browser automatically
read -p "Open in default browser now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Opening browser..."
    open "http://localhost:8080" 2>/dev/null || xdg-open "http://localhost:8080" 2>/dev/null || echo "Please open http://localhost:8080 manually"
    sleep 2
    echo ""
    echo "Now open another browser (Safari/Firefox) to: http://localhost:8080"
fi

echo ""
echo "🎯 Happy collaborating!"
