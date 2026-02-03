#!/bin/bash
set -e

# Generate Canary Tokens Script
# Creates unique canary tokens for an instance

INSTANCE_ID="${1:-local-dev}"
OUTPUT_DIR="${2:-./canaries}"

echo "🎣 Generating canary tokens for instance: $INSTANCE_ID"

mkdir -p "$OUTPUT_DIR"

# Generate random components
RANDOM_32=$(openssl rand -hex 16)
RANDOM_40=$(openssl rand -hex 20)
INSTANCE_CLEAN=$(echo "$INSTANCE_ID" | tr -cd '[:alnum:]' | head -c 8)

# Generate OpenClaw config
cat > "$OUTPUT_DIR/openclaw.json" << EOF
{
  "openai_api_key": "sk-proj-clawtrap${INSTANCE_CLEAN}${RANDOM_32}",
  "anthropic_api_key": "sk-ant-api03-clawtrap${INSTANCE_CLEAN}${RANDOM_40}",
  "telegram_bot_token": "$((RANDOM % 9000000000 + 1000000000)):clawtrap-${INSTANCE_ID}-${RANDOM_32:0:20}",
  "slack_token": "xoxb-clawtrap-${INSTANCE_ID}-${RANDOM_32:0:24}",
  "database_url": "postgresql://admin:clawtrap${INSTANCE_CLEAN}@db.internal:5432/openclaw",
  "default_model": "gpt-4",
  "workspace": "/opt/openclaw"
}
EOF

# Generate AWS credentials
cat > "$OUTPUT_DIR/aws-credentials" << EOF
[default]
aws_access_key_id = AKIACLAWTRAP${INSTANCE_CLEAN^^}
aws_secret_access_key = clawtrap_secret_${INSTANCE_ID}_${RANDOM_40}
region = us-east-1
EOF

# Generate environment file
cat > "$OUTPUT_DIR/.env" << EOF
OPENAI_API_KEY=sk-proj-clawtrap${INSTANCE_CLEAN}${RANDOM_32}
ANTHROPIC_API_KEY=sk-ant-api03-clawtrap${INSTANCE_CLEAN}${RANDOM_40}
DATABASE_URL=postgresql://admin:clawtrap${INSTANCE_CLEAN}@db.internal:5432/openclaw
SLACK_BOT_TOKEN=xoxb-clawtrap-${INSTANCE_ID}-${RANDOM_32:0:24}
AWS_ACCESS_KEY_ID=AKIACLAWTRAP${INSTANCE_CLEAN^^}
AWS_SECRET_ACCESS_KEY=clawtrap_secret_${INSTANCE_ID}_${RANDOM_40}
EOF

echo "✅ Canary tokens generated in: $OUTPUT_DIR"
echo ""
echo "Files created:"
ls -la "$OUTPUT_DIR"
