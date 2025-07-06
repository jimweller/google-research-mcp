#!/bin/bash

# SSE Test Runner Script
# Properly handles server startup, test execution, and cleanup

set -e

echo "🔧 Building project..."
npm run build

echo "🚀 Starting server for SSE test..."
npm run start &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Function to cleanup server
cleanup() {
    echo "🧹 Cleaning up server (PID: $SERVER_PID)..."
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
        sleep 2
        # Force kill if still running
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo "Force killing server..."
            kill -9 $SERVER_PID 2>/dev/null || true
        fi
    fi
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT

echo "⏳ Waiting for server to be ready..."
sleep 10

echo "🧪 Running SSE test..."
node tests/e2e/e2e_sse_mcp_client_test.mjs

echo "🎉 SSE test completed successfully!"