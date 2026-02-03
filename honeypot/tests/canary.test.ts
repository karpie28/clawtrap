import { CanaryGenerator, generateCanaryFiles } from '../src/canary/generator';

describe('CanaryGenerator', () => {
  let generator: CanaryGenerator;

  beforeEach(() => {
    generator = new CanaryGenerator('test-instance-001');
  });

  describe('Token Generation', () => {
    it('should generate OpenAI API key format', () => {
      const token = generator.generate('openai_api_key');
      expect(token.value).toMatch(/^sk-proj-clawtrap/);
      expect(token.type).toBe('openai_api_key');
      expect(token.instanceId).toBe('test-instance-001');
    });

    it('should generate Anthropic API key format', () => {
      const token = generator.generate('anthropic_api_key');
      expect(token.value).toMatch(/^sk-ant-api03-clawtrap/);
    });

    it('should generate AWS access key format', () => {
      const token = generator.generate('aws_access_key');
      expect(token.value).toMatch(/^AKIACLAWTRAP/);
      expect(token.value.length).toBe(20); // Standard AWS key length
    });

    it('should generate AWS secret key format', () => {
      const token = generator.generate('aws_secret_key');
      expect(token.value).toMatch(/^clawtrap_secret_/);
    });

    it('should generate GitHub token format', () => {
      const token = generator.generate('github_token');
      expect(token.value).toMatch(/^ghp_clawtrap/);
    });

    it('should generate Slack token format', () => {
      const token = generator.generate('slack_token');
      expect(token.value).toMatch(/^xoxb-clawtrap/);
    });

    it('should generate database URL format', () => {
      const token = generator.generate('database_url');
      expect(token.value).toMatch(/^postgresql:\/\//);
      expect(token.value).toContain('clawtrap');
    });

    it('should generate SSH key format', () => {
      const token = generator.generate('ssh_key');
      expect(token.value).toContain('-----BEGIN OPENSSH PRIVATE KEY-----');
      expect(token.value).toContain('-----END OPENSSH PRIVATE KEY-----');
      expect(token.value).toContain('CLAWTRAP');
    });

    it('should generate Kubernetes token format', () => {
      const token = generator.generate('kubernetes_token');
      expect(token.value).toMatch(/^eyJ/); // Base64 JWT header
    });
  });

  describe('Token Metadata', () => {
    it('should include creation timestamp', () => {
      const token = generator.generate('openai_api_key');
      expect(token.createdAt).toBeInstanceOf(Date);
    });

    it('should include token ID', () => {
      const token = generator.generate('openai_api_key');
      expect(token.id).toBeDefined();
      expect(token.id.length).toBe(12);
    });

    it('should support custom metadata', () => {
      const token = generator.generate('openai_api_key', { location: 'test-file' });
      expect(token.metadata.location).toBe('test-file');
    });
  });

  describe('Token Set Generation', () => {
    it('should generate a complete token set', () => {
      const tokens = generator.generateTokenSet();
      expect(tokens.size).toBeGreaterThan(0);
      expect(tokens.has('openai_api_key')).toBe(true);
      expect(tokens.has('anthropic_api_key')).toBe(true);
      expect(tokens.has('aws_access_key')).toBe(true);
      expect(tokens.has('aws_secret_key')).toBe(true);
    });

    it('should generate unique tokens for each type', () => {
      const tokens = generator.generateTokenSet();
      const values = Array.from(tokens.values()).map(t => t.value);
      const uniqueValues = [...new Set(values)];
      expect(values.length).toBe(uniqueValues.length);
    });
  });

  describe('Canary Detection', () => {
    it('should identify canary tokens', () => {
      const token = generator.generate('openai_api_key');
      expect(generator.isCanaryToken(token.value)).toBe(true);
    });

    it('should not identify real tokens as canaries', () => {
      expect(generator.isCanaryToken('sk-proj-realkey12345')).toBe(false);
    });

    it('should extract canary ID from token', () => {
      const token = generator.generate('openai_api_key');
      const extractedId = generator.extractCanaryId(token.value);
      expect(extractedId).toBeDefined();
    });
  });

  describe('File Generation', () => {
    it('should generate canary files', () => {
      const files = generateCanaryFiles(generator);
      expect(files.size).toBeGreaterThan(0);
    });

    it('should generate OpenClaw config file', () => {
      const files = generateCanaryFiles(generator);
      const config = files.get('~/.openclaw/openclaw.json');
      expect(config).toBeDefined();
      const parsed = JSON.parse(config!);
      expect(parsed.openai_api_key).toMatch(/clawtrap/);
    });

    it('should generate AWS credentials file', () => {
      const files = generateCanaryFiles(generator);
      const creds = files.get('~/.aws/credentials');
      expect(creds).toBeDefined();
      expect(creds).toContain('AKIACLAWTRAP');
    });

    it('should generate environment file', () => {
      const files = generateCanaryFiles(generator);
      const env = files.get('/opt/openclaw/.env');
      expect(env).toBeDefined();
      expect(env).toContain('OPENAI_API_KEY');
    });
  });

  describe('Instance Isolation', () => {
    it('should generate different tokens for different instances', () => {
      const gen1 = new CanaryGenerator('instance-001');
      const gen2 = new CanaryGenerator('instance-002');

      const token1 = gen1.generate('openai_api_key');
      const token2 = gen2.generate('openai_api_key');

      expect(token1.value).not.toBe(token2.value);
      expect(token1.instanceId).toBe('instance-001');
      expect(token2.instanceId).toBe('instance-002');
    });
  });
});
