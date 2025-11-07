#!/bin/bash
# Test server script - kills any existing server and starts a new one

echo "🔍 Checking for existing server processes..."
EXISTING_PID=$(lsof -ti:1000 2>/dev/null || lsof -ti:3000 2>/dev/null)

if [ ! -z "$EXISTING_PID" ]; then
    echo "⚠️  Found existing server on port 1000 or 3000 (PID: $EXISTING_PID)"
    echo "🛑 Killing existing process..."
    kill $EXISTING_PID 2>/dev/null
    sleep 1
    echo "✅ Existing server stopped"
fi

# Kill any node server.js processes
pkill -f "node server.js" 2>/dev/null
sleep 1

echo ""
echo "🚀 Starting server on port 3000..."
echo ""

# Start server on port 3000 (override .env PORT setting)
PORT=3000 node server.js

