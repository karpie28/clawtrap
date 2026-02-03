#!/bin/bash
set -e

# ClawTrap Local Development Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🐾 Starting ClawTrap local development environment..."

# Check dependencies
check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is required but not installed."
        exit 1
    fi
}

check_dependency docker

# Create logs directory
mkdir -p "$PROJECT_ROOT/honeypot/logs"

# Build and start containers
cd "$PROJECT_ROOT/honeypot"

echo "📦 Building Docker images..."
docker compose build clawtrap

echo "🚀 Starting services..."
docker compose up -d clawtrap

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8443/health 2>/dev/null | grep -q "200"; then
    echo "✅ HTTP API is healthy"
else
    echo "⚠️  HTTP API may still be starting..."
fi

echo ""
echo "🐾 ClawTrap is running!"
echo ""
echo "Services:"
echo "  • HTTP API: http://localhost:8443"
echo "  • WebSocket: ws://localhost:18789"
echo ""
echo "Test commands:"
echo "  curl http://localhost:8443/health"
echo "  curl http://localhost:8443/api/v1/chat -H 'Content-Type: application/json' -d '{\"message\": \"Hello\"}'"
echo ""
echo "View logs:"
echo "  docker compose logs -f clawtrap"
echo ""
echo "Stop with:"
echo "  docker compose down"
