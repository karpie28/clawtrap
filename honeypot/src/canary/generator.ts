import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface CanaryToken {
  id: string;
  type: CanaryTokenType;
  value: string;
  instanceId: string;
  createdAt: Date;
  metadata: Record<string, string>;
}

export type CanaryTokenType =
  | 'openai_api_key'
  | 'anthropic_api_key'
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'github_token'
  | 'slack_token'
  | 'telegram_token'
  | 'database_url'
  | 'ssh_key'
  | 'kubernetes_token'
  | 'generic_api_key';

export class CanaryGenerator {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  generate(type: CanaryTokenType, metadata: Record<string, string> = {}): CanaryToken {
    const id = uuidv4().replace(/-/g, '').substring(0, 12);
    const value = this.generateTokenValue(type, id);

    return {
      id,
      type,
      value,
      instanceId: this.instanceId,
      createdAt: new Date(),
      metadata,
    };
  }

  private generateTokenValue(type: CanaryTokenType, id: string): string {
    const randomPart = randomBytes(16).toString('hex');
    const instancePart = this.instanceId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);

    switch (type) {
      case 'openai_api_key':
        return `sk-proj-clawtrap${instancePart}${randomPart.substring(0, 32)}`;

      case 'anthropic_api_key':
        return `sk-ant-api03-clawtrap${instancePart}${randomPart.substring(0, 40)}`;

      case 'aws_access_key':
        return `AKIACLAWTRAP${instancePart.toUpperCase()}${randomPart.substring(0, 8).toUpperCase()}`;

      case 'aws_secret_key':
        return `clawtrap_secret_${instancePart}_${randomPart}`;

      case 'github_token':
        return `ghp_clawtrap${instancePart}${randomPart.substring(0, 24)}`;

      case 'slack_token':
        return `xoxb-clawtrap-${instancePart}-${randomPart.substring(0, 24)}`;

      case 'telegram_token':
        return `${Math.floor(Math.random() * 9000000000) + 1000000000}:clawtrap-${instancePart}-${randomPart.substring(0, 20)}`;

      case 'database_url':
        return `postgresql://admin:clawtrap${instancePart}${randomPart.substring(0, 16)}@db.internal:5432/openclaw`;

      case 'ssh_key':
        return this.generateFakeSSHKey(instancePart);

      case 'kubernetes_token':
        return `eyJhbGciOiJSUzI1NiIsImtpZCI6ImNsYXd0cmFwLSR7aW5zdGFuY2VQYXJ0fSJ9.${Buffer.from(JSON.stringify({
          iss: 'kubernetes/serviceaccount',
          sub: `system:serviceaccount:default:clawtrap-${instancePart}`,
          aud: ['https://kubernetes.default.svc'],
          exp: Math.floor(Date.now() / 1000) + 31536000,
          iat: Math.floor(Date.now() / 1000),
        })).toString('base64url')}.${randomPart}`;

      case 'generic_api_key':
      default:
        return `clawtrap_${instancePart}_${randomPart}`;
    }
  }

  private generateFakeSSHKey(instancePart: string): string {
    // Generate a fake-looking RSA private key that's actually a canary
    const header = '-----BEGIN OPENSSH PRIVATE KEY-----';
    const footer = '-----END OPENSSH PRIVATE KEY-----';

    // Create base64-like content with embedded canary identifier
    const canaryMarker = Buffer.from(`CLAWTRAP:${instancePart}:${Date.now()}`).toString('base64');
    const fakeKeyContent = randomBytes(200).toString('base64');

    // Insert canary marker in the middle
    const midPoint = Math.floor(fakeKeyContent.length / 2);
    const modifiedContent = fakeKeyContent.substring(0, midPoint) + canaryMarker + fakeKeyContent.substring(midPoint);

    // Format as SSH key with line breaks
    const lines: string[] = [];
    for (let i = 0; i < modifiedContent.length; i += 70) {
      lines.push(modifiedContent.substring(i, i + 70));
    }

    return `${header}\n${lines.join('\n')}\n${footer}`;
  }

  generateTokenSet(): Map<CanaryTokenType, CanaryToken> {
    const tokens = new Map<CanaryTokenType, CanaryToken>();

    const types: CanaryTokenType[] = [
      'openai_api_key',
      'anthropic_api_key',
      'aws_access_key',
      'aws_secret_key',
      'github_token',
      'slack_token',
      'database_url',
    ];

    for (const type of types) {
      tokens.set(type, this.generate(type));
    }

    return tokens;
  }

  extractCanaryId(token: string): string | null {
    // Try to extract the canary ID from various token formats
    const patterns = [
      /clawtrap([a-zA-Z0-9]{8})/i,
      /CLAWTRAP:([^:]+):/,
      /clawtrap-([a-zA-Z0-9-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = token.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  isCanaryToken(token: string): boolean {
    const indicators = [
      'clawtrap',
      'CLAWTRAP',
      'honeypot',
    ];

    return indicators.some(indicator =>
      token.toLowerCase().includes(indicator.toLowerCase())
    );
  }
}

export function generateCanaryFiles(generator: CanaryGenerator): Map<string, string> {
  const files = new Map<string, string>();
  const tokens = generator.generateTokenSet();

  // ~/.openclaw/openclaw.json
  files.set('~/.openclaw/openclaw.json', JSON.stringify({
    openai_api_key: tokens.get('openai_api_key')?.value,
    anthropic_api_key: tokens.get('anthropic_api_key')?.value,
    default_model: 'gpt-4',
    workspace: '/opt/openclaw',
    telemetry: true,
  }, null, 2));

  // ~/.aws/credentials
  files.set('~/.aws/credentials', `[default]
aws_access_key_id = ${tokens.get('aws_access_key')?.value}
aws_secret_access_key = ${tokens.get('aws_secret_key')?.value}
region = us-east-1

[openclaw-production]
aws_access_key_id = ${tokens.get('aws_access_key')?.value}
aws_secret_access_key = ${tokens.get('aws_secret_key')?.value}
region = us-west-2
`);

  // ~/.config/gh/hosts.yml (GitHub CLI)
  files.set('~/.config/gh/hosts.yml', `github.com:
    oauth_token: ${tokens.get('github_token')?.value}
    user: openclaw-bot
    git_protocol: https
`);

  // Environment file template
  files.set('/opt/openclaw/.env', `# OpenClaw Configuration
OPENAI_API_KEY=${tokens.get('openai_api_key')?.value}
ANTHROPIC_API_KEY=${tokens.get('anthropic_api_key')?.value}
DATABASE_URL=${tokens.get('database_url')?.value}
SLACK_BOT_TOKEN=${tokens.get('slack_token')?.value}
AWS_ACCESS_KEY_ID=${tokens.get('aws_access_key')?.value}
AWS_SECRET_ACCESS_KEY=${tokens.get('aws_secret_key')?.value}

# Internal settings
DEBUG=false
LOG_LEVEL=info
`);

  return files;
}
