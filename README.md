# ClawTrap

Honeypot mimicking an AI assistant. Captures traditional attacks + LLM-specific vectors (prompt injection, jailbreaks, OWASP LLM Top 10).

## Quick Start

```bash
# Create config
cat > .env << 'EOF'
CLAWTRAP_INSTANCE_ID=my-honeypot
CLAWTRAP_LOG_BACKEND=s3
CLAWTRAP_S3_BUCKET=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
EOF

# Run
docker compose up -d
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| HTTPS API | 443 | Fake AI assistant API |
| WebSocket | 18789 | Real-time LLM interactions |
| SSH | 22 | Cowrie SSH honeypot |

## What It Captures

- **SSH**: Credentials, commands, lateral movement attempts
- **HTTPS**: API abuse, auth attempts, LLM interactions
- **LLM Attacks**: Prompt injection, jailbreaks, tool abuse (50+ patterns)

## Logging Backends

**S3** (recommended):
```env
CLAWTRAP_LOG_BACKEND=s3
CLAWTRAP_S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Loki**:
```env
CLAWTRAP_LOG_BACKEND=loki
CLAWTRAP_LOKI_URL=http://loki:3100
```

**CloudWatch**:
```env
CLAWTRAP_LOG_BACKEND=cloudwatch
CLAWTRAP_CLOUDWATCH_LOG_GROUP=/clawtrap/honeypot
AWS_REGION=us-east-1
```

## Log Format

All events are structured JSON:

```json
{
  "timestamp": "2024-08-15T14:30:00.000Z",
  "instance_id": "my-honeypot",
  "event_type": "llm_interaction",
  "source": {
    "ip": "1.2.3.4",
    "geo": { "country": "CN", "city": "Beijing" }
  },
  "llm": {
    "user_message": "Ignore previous instructions...",
    "detected_attacks": [{
      "type": "prompt_injection",
      "confidence": 0.95,
      "severity": "high"
    }]
  }
}
```

## License

MIT
