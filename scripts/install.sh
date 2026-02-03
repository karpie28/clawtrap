#!/bin/bash
set -e

# ClawTrap Quick Install Script
# Usage: curl -sSL https://raw.githubusercontent.com/clawtrap/clawtrap/main/scripts/install.sh | bash

echo "🐾 Installing ClawTrap honeypot..."

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Create directory
mkdir -p /opt/clawtrap
cd /opt/clawtrap

# Generate instance ID
INSTANCE_ID="clawtrap-$(head /dev/urandom | tr -dc 'a-z0-9' | head -c 8)"

# Create default config
cat > .env << EOF
# ClawTrap Configuration
CLAWTRAP_INSTANCE_ID=${INSTANCE_ID}

# REQUIRED: Choose a logging backend and configure it

# Option 1: S3 (recommended - most cost efficient, query with Grafana+Athena)
CLAWTRAP_LOG_BACKEND=s3
CLAWTRAP_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# Option 2: Loki (if you have existing Grafana/Loki stack)
# CLAWTRAP_LOG_BACKEND=loki
# CLAWTRAP_LOKI_URL=http://your-loki:3100

# Option 3: CloudWatch (for AWS, higher cost but real-time)
# CLAWTRAP_LOG_BACKEND=cloudwatch
# CLAWTRAP_CLOUDWATCH_LOG_GROUP=/clawtrap/honeypot
# AWS_REGION=us-east-1

# Optional: Canary callback URL
# CLAWTRAP_CANARY_CALLBACK_URL=https://your-callback/canary
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  clawtrap:
    image: clawtrap/honeypot:latest
    restart: always
    ports:
      - "443:443"
      - "18789:18789"
    env_file:
      - .env

  cowrie:
    image: clawtrap/cowrie:latest
    restart: always
    ports:
      - "22:2222"
    environment:
      - COWRIE_HOSTNAME=openclaw-server
EOF

echo ""
echo "✅ ClawTrap installed to /opt/clawtrap"
echo ""
echo "⚠️  IMPORTANT: Configure logging before starting!"
echo "   Edit /opt/clawtrap/.env and set your logging backend"
echo ""
echo "Then start with:"
echo "   cd /opt/clawtrap && docker compose up -d"
echo ""
echo "Services will be available on:"
echo "   • HTTPS API: :443"
echo "   • WebSocket: :18789"
echo "   • SSH Honeypot: :22"
