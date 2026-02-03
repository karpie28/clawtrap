# ClawTrap

Honeypot mimicking an AI assistant. Captures LLM-specific attack vectors (prompt injection, jailbreaks, tool abuse).

## Architecture

- **10 Fargate containers** with unique public IPs
- **FARGATE_SPOT + ARM64** for cost optimization
- **S3 logging** with partitioned structure
- **GitHub Actions** CI/CD with OIDC auth

## Deployment

Infrastructure is deployed via CloudFormation to AWS us-east-2.

```bash
# Deploy infrastructure (run once)
./cloudformation/deploy.sh

# Add AWS_ROLE_ARN to GitHub Secrets, then push to main to deploy app
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| HTTP API | 8443 | Fake AI assistant API |
| WebSocket | 18789 | MCP protocol connections |

## What It Captures

- **LLM Attacks**: Prompt injection, jailbreaks, tool abuse (38 patterns)
- **HTTP**: API abuse, auth attempts, suspicious payloads
- **WebSocket**: Real-time LLM interactions

## Logs

Logs are stored in S3 with partitioned structure:

```
s3://clawtrap-production-logs-{account}/clawtrap-logs/year=2026/month=02/day=03/hour=02/
```

Format: gzip-compressed JSONL

```json
{
  "timestamp": "2026-02-03T02:33:43.356Z",
  "level": "info",
  "component": "main",
  "instance_id": "ip-10-0-2-89.us-east-2.compute.internal",
  "message": "ClawTrap honeypot started successfully"
}
```

## Useful Commands

```bash
# Get public IPs
aws ecs list-tasks --cluster clawtrap-production --query 'taskArns[]' --output text | \
  xargs -I{} aws ecs describe-tasks --cluster clawtrap-production --tasks {} \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text | \
  xargs -I{} aws ec2 describe-network-interfaces --network-interface-ids {} \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text

# Rotate IPs (force new deployment)
aws ecs update-service --cluster clawtrap-production --service clawtrap-production --force-new-deployment

# View logs
aws logs tail /ecs/clawtrap-production --since 10m --follow
```

## License

MIT
