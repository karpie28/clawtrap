import { Router, Request, Response } from 'express';
import { Config } from '../../config';
import { LoggerFactory } from '../../logging';

const logger = LoggerFactory.getLogger('discovery');

/**
 * Discovery routes - these serve fake sensitive files and AI discovery manifests
 * to funnel scanner traffic toward the AI endpoints.
 *
 * Priority targets:
 * 1. Scanners already hitting us (LeakIX, Censys, zgrab)
 * 2. AI agent discovery mechanisms (MCP, OpenAI plugins)
 * 3. ML/AI service fingerprinting (vLLM, Ollama, Jupyter)
 */
export function createDiscoveryRoutes(config: Config): Router {
  const router = Router();

  // Get instance IP for dynamic URLs (falls back to placeholder)
  const instanceIp = config.instance_ip || process.env.CLAWTRAP_INSTANCE_IP || 'INSTANCE_IP';
  const httpPort = config.server.http_port;
  const wsPort = config.server.ws_port;

  // ============================================================
  // PRIORITY 1: Make probed paths return breadcrumbs to AI endpoints
  // ============================================================

  // Fake .env file with canary API keys
  router.get('/.env', (req: Request, res: Response) => {
    logger.warn('Sensitive file accessed: .env', {
      event_type: 'sensitive_file_access',
      file: '.env',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.type('text/plain').send(`# OpenClaw Production Configuration
# WARNING: Do not commit this file!

NODE_ENV=production
PORT=${httpPort}

# AI Provider Keys
OPENAI_API_KEY=sk-proj-clawtrap-prod-8xK9mQ2nL5vR7wY3
ANTHROPIC_API_KEY=sk-ant-api03-clawtrap-prod-7Hj2kL9mN4pQ
COHERE_API_KEY=clawtrap-cohere-prod-5tR8yU2iO

# Internal MCP Server
MCP_SERVER_URL=ws://${instanceIp}:${wsPort}
MCP_AUTH_TOKEN=mcp-clawtrap-internal-auth-2025

# Database
DATABASE_URL=postgresql://openclaw:OC-db-prod-2025!@db.internal.openclaw.ai:5432/openclaw
REDIS_URL=redis://:clawtrap-redis-secret@cache.internal.openclaw.ai:6379

# AWS
AWS_ACCESS_KEY_ID=AKIACLAWTRAP2025PROD
AWS_SECRET_ACCESS_KEY=clawtrap+aws+secret+key+2025+prod+xK9mQ
AWS_REGION=us-east-2
S3_BUCKET=openclaw-models-prod

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/clawtrap-webhook
SLACK_BOT_TOKEN=xoxb-clawtrap-slack-bot-token-2025

# Stripe
STRIPE_SECRET_KEY=sk_live_clawtrap_stripe_2025_prod
STRIPE_WEBHOOK_SECRET=whsec_clawtrap_webhook_secret

# JWT
JWT_SECRET=clawtrap-jwt-super-secret-key-do-not-share-2025
SESSION_SECRET=clawtrap-session-secret-prod-2025
`);
  });

  // Fake .git/config
  router.get('/.git/config', (req: Request, res: Response) => {
    logger.warn('Sensitive file accessed: .git/config', {
      event_type: 'sensitive_file_access',
      file: '.git/config',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.type('text/plain').send(`[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = git@github.com:openclaw-ai/openclaw-api.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[remote "internal"]
	url = git@gitlab.internal.openclaw.ai:ml-team/openclaw-models.git
	fetch = +refs/heads/*:refs/remotes/internal/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
[branch "deploy-prod"]
	remote = origin
	merge = refs/heads/deploy-prod
[user]
	name = OpenClaw Deploy Bot
	email = deploy@openclaw.ai
`);
  });

  // Fake config.json with MCP server details
  router.get('/config.json', (req: Request, res: Response) => {
    logger.warn('Sensitive file accessed: config.json', {
      event_type: 'sensitive_file_access',
      file: 'config.json',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      app: {
        name: 'OpenClaw API',
        version: '2.4.1',
        environment: 'production',
      },
      api: {
        base_url: `http://${instanceIp}:${httpPort}`,
        openai_compatible: true,
        endpoints: {
          chat: '/api/v1/chat',
          completions: '/api/v1/completions',
          models: '/v1/models',
          embeddings: '/api/v1/embeddings',
        },
      },
      mcp: {
        enabled: true,
        server_url: `ws://${instanceIp}:${wsPort}`,
        auth_token: 'mcp-clawtrap-internal-auth-2025',
        available_tools: ['web_search', 'code_execute', 'file_read', 'database_query'],
      },
      models: {
        default: 'meta-llama/Llama-3.1-70B-Instruct',
        available: [
          'meta-llama/Llama-3.1-70B-Instruct',
          'meta-llama/Llama-3.1-8B-Instruct',
          'mistralai/Mixtral-8x7B-Instruct-v0.1',
          'gpt-4-turbo',
          'claude-3-opus',
        ],
      },
      _internal: {
        debug_key: 'sk-proj-clawtrap-debug-2025xK9mQ',
        admin_endpoint: '/api/internal/admin',
      },
    });
  });

  // Fake Spring Boot actuator/env
  router.get('/actuator/env', (req: Request, res: Response) => {
    logger.warn('Actuator endpoint accessed', {
      event_type: 'sensitive_file_access',
      file: '/actuator/env',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      activeProfiles: ['prod'],
      propertySources: [
        {
          name: 'systemEnvironment',
          properties: {
            OPENAI_API_KEY: { value: 'sk-proj-clawtrap-actuator-8xK9' },
            ANTHROPIC_API_KEY: { value: 'sk-ant-api03-clawtrap-act-7Hj2' },
            MCP_SERVER_URL: { value: `ws://${instanceIp}:${wsPort}` },
            DATABASE_URL: { value: 'postgresql://openclaw:******@db.internal:5432/openclaw' },
            AWS_ACCESS_KEY_ID: { value: 'AKIACLAWTRAPACTUATOR' },
          },
        },
        {
          name: 'applicationConfig',
          properties: {
            'spring.datasource.url': { value: 'jdbc:postgresql://db.internal:5432/openclaw' },
            'openclaw.api.secret': { value: '******' },
            'openclaw.mcp.endpoint': { value: `ws://${instanceIp}:${wsPort}` },
          },
        },
      ],
    });
  });

  // Swagger/OpenAPI spec pointing to AI endpoints
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'OpenClaw API',
      description: 'OpenAI-compatible AI API with MCP tool support',
      version: '2.4.1',
      contact: { email: 'api@openclaw.ai' },
    },
    servers: [
      { url: `http://${instanceIp}:${httpPort}`, description: 'Production' },
      { url: 'https://api.openclaw.ai', description: 'Public endpoint' },
    ],
    paths: {
      '/v1/models': {
        get: {
          summary: 'List available models',
          responses: { '200': { description: 'Model list' } },
        },
      },
      '/v1/chat/completions': {
        post: {
          summary: 'Create chat completion (OpenAI compatible)',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatRequest' },
              },
            },
          },
        },
      },
      '/api/v1/chat': {
        post: {
          summary: 'Chat endpoint (native)',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/v1/embeddings': {
        post: { summary: 'Generate embeddings' },
      },
      '/mcp/connect': {
        get: {
          summary: 'MCP WebSocket connection',
          description: `Connect via WebSocket at ws://${instanceIp}:${wsPort}`,
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key (sk-...)',
        },
      },
      schemas: {
        ChatRequest: {
          type: 'object',
          properties: {
            model: { type: 'string', example: 'gpt-4' },
            messages: { type: 'array' },
            stream: { type: 'boolean' },
          },
        },
      },
    },
  };

  router.get('/swagger.json', (req: Request, res: Response) => {
    logger.info('Swagger spec accessed', {
      event_type: 'api_discovery',
      endpoint: '/swagger.json',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });
    res.json(openApiSpec);
  });

  router.get('/api-docs/swagger.json', (req: Request, res: Response) => {
    logger.info('Swagger spec accessed', {
      event_type: 'api_discovery',
      endpoint: '/api-docs/swagger.json',
      source_ip: req.ip,
    });
    res.json(openApiSpec);
  });

  router.get('/v2/api-docs', (req: Request, res: Response) => {
    logger.info('Swagger v2 spec accessed', {
      event_type: 'api_discovery',
      endpoint: '/v2/api-docs',
      source_ip: req.ip,
    });
    res.json(openApiSpec);
  });

  router.get('/v3/api-docs', (req: Request, res: Response) => {
    logger.info('Swagger v3 spec accessed', {
      event_type: 'api_discovery',
      endpoint: '/v3/api-docs',
      source_ip: req.ip,
    });
    res.json(openApiSpec);
  });

  // Swagger UI HTML that loads our spec
  router.get(['/swagger-ui.html', '/swagger/index.html', '/webjars/swagger-ui/index.html'], (req: Request, res: Response) => {
    logger.info('Swagger UI accessed', {
      event_type: 'api_discovery',
      endpoint: req.path,
      source_ip: req.ip,
    });

    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>OpenClaw API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/swagger.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    });
  </script>
</body>
</html>`);
  });

  // ============================================================
  // PRIORITY 2: MCP Discovery endpoints
  // ============================================================

  // MCP discovery manifest (emerging standard)
  router.get('/.well-known/mcp.json', (req: Request, res: Response) => {
    logger.info('MCP discovery manifest accessed', {
      event_type: 'mcp_discovery',
      endpoint: '/.well-known/mcp.json',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      name: 'OpenClaw MCP Server',
      description: 'Enterprise AI tools - search, code execution, database queries, file operations',
      version: '1.0.0',
      protocol_version: '2024-11-05',
      endpoints: {
        websocket: `ws://${instanceIp}:${wsPort}`,
        http: `http://${instanceIp}:${httpPort}/mcp`,
      },
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        sampling: false,
      },
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information',
        },
        {
          name: 'code_execute',
          description: 'Execute code in a sandboxed environment',
        },
        {
          name: 'file_read',
          description: 'Read files from the workspace',
        },
        {
          name: 'database_query',
          description: 'Execute SQL queries against connected databases',
        },
        {
          name: 'api_request',
          description: 'Make HTTP requests to external APIs',
        },
      ],
      authentication: {
        type: 'bearer',
        token_endpoint: `http://${instanceIp}:${httpPort}/auth/token`,
      },
    });
  });

  // ============================================================
  // PRIORITY 3: ChatGPT Plugin manifest
  // ============================================================

  router.get('/.well-known/ai-plugin.json', (req: Request, res: Response) => {
    logger.info('AI plugin manifest accessed', {
      event_type: 'ai_plugin_discovery',
      endpoint: '/.well-known/ai-plugin.json',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      schema_version: 'v1',
      name_for_human: 'OpenClaw Tools',
      name_for_model: 'openclaw_tools',
      description_for_human: 'Access powerful AI tools including web search, code execution, and data analysis.',
      description_for_model: 'OpenClaw provides tools for web search, code execution in multiple languages, file operations, and database queries. Use these tools to help users with complex tasks requiring external data or computation.',
      auth: {
        type: 'service_http',
        authorization_type: 'bearer',
        verification_tokens: {
          openai: 'clawtrap-openai-verification-token-2025',
        },
      },
      api: {
        type: 'openapi',
        url: `http://${instanceIp}:${httpPort}/swagger.json`,
      },
      logo_url: `http://${instanceIp}:${httpPort}/logo.png`,
      contact_email: 'plugins@openclaw.ai',
      legal_info_url: 'https://openclaw.ai/legal',
    });
  });

  // ============================================================
  // PRIORITY 7: vLLM/Ollama compatible /v1/models endpoint
  // ============================================================

  router.get('/v1/models', (req: Request, res: Response) => {
    logger.info('OpenAI-compatible models endpoint accessed', {
      event_type: 'llm_discovery',
      endpoint: '/v1/models',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      object: 'list',
      data: [
        {
          id: 'meta-llama/Llama-3.1-70B-Instruct',
          object: 'model',
          created: 1700000000,
          owned_by: 'meta-llama',
          permission: [],
          root: 'meta-llama/Llama-3.1-70B-Instruct',
          parent: null,
        },
        {
          id: 'meta-llama/Llama-3.1-8B-Instruct',
          object: 'model',
          created: 1700000000,
          owned_by: 'meta-llama',
        },
        {
          id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          object: 'model',
          created: 1700000000,
          owned_by: 'mistralai',
        },
        {
          id: 'Qwen/Qwen2.5-72B-Instruct',
          object: 'model',
          created: 1700000000,
          owned_by: 'Qwen',
        },
        {
          id: 'gpt-4-turbo',
          object: 'model',
          created: 1700000000,
          owned_by: 'openclaw',
        },
        {
          id: 'claude-3-opus',
          object: 'model',
          created: 1700000000,
          owned_by: 'openclaw',
        },
      ],
    });
  });

  // OpenAI-compatible chat completions at /v1/chat/completions
  router.post('/v1/chat/completions', (req: Request, res: Response) => {
    // Redirect to main API handler
    req.url = '/api/v1/chat';
    res.redirect(307, '/api/v1/chat');
  });

  // ============================================================
  // PRIORITY 4: Fake Jupyter/Gradio surface
  // ============================================================

  // Jupyter API endpoints
  router.get('/api/kernels', (req: Request, res: Response) => {
    logger.warn('Jupyter kernels endpoint accessed', {
      event_type: 'jupyter_discovery',
      endpoint: '/api/kernels',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json([
      {
        id: 'kernel-clawtrap-001',
        name: 'python3',
        last_activity: new Date().toISOString(),
        execution_state: 'idle',
        connections: 1,
      },
    ]);
  });

  router.get('/api/sessions', (req: Request, res: Response) => {
    logger.warn('Jupyter sessions endpoint accessed', {
      event_type: 'jupyter_discovery',
      endpoint: '/api/sessions',
      source_ip: req.ip,
    });

    res.json([
      {
        id: 'session-clawtrap-001',
        path: 'notebooks/model_training.ipynb',
        name: 'model_training.ipynb',
        type: 'notebook',
        kernel: {
          id: 'kernel-clawtrap-001',
          name: 'python3',
        },
      },
    ]);
  });

  router.get('/tree', (req: Request, res: Response) => {
    logger.warn('Jupyter tree accessed', {
      event_type: 'jupyter_discovery',
      endpoint: '/tree',
      source_ip: req.ip,
    });

    res.send(`<!DOCTYPE html>
<html>
<head><title>Jupyter Notebook</title></head>
<body>
<h1>Jupyter Notebook - OpenClaw ML Workspace</h1>
<p>Please <a href="/login">login</a> to continue.</p>
<!-- Internal: API key for notebook auth: sk-proj-clawtrap-jupyter-auth -->
</body>
</html>`);
  });

  // Gradio API (common for ML demos)
  router.get('/api/predict', (req: Request, res: Response) => {
    logger.info('Gradio predict endpoint accessed', {
      event_type: 'gradio_discovery',
      endpoint: '/api/predict',
      source_ip: req.ip,
    });

    res.status(405).json({ error: 'Method not allowed. Use POST.' });
  });

  router.post('/api/predict', (req: Request, res: Response) => {
    logger.warn('Gradio predict called', {
      event_type: 'gradio_inference_attempt',
      endpoint: '/api/predict',
      body: req.body,
      source_ip: req.ip,
    });

    res.json({
      data: ['Model output would appear here'],
      duration: 0.5,
    });
  });

  // ============================================================
  // Additional scanner honeypots
  // ============================================================

  // Laravel Telescope (popular scanner target)
  router.get('/telescope/requests', (req: Request, res: Response) => {
    logger.info('Laravel Telescope accessed', {
      event_type: 'recon_telescope',
      source_ip: req.ip,
    });

    res.json({
      entries: [],
      status: 'Telescope is running. Authentication required.',
      _debug: {
        api_endpoint: `http://${instanceIp}:${httpPort}/api/v1/chat`,
        mcp_endpoint: `ws://${instanceIp}:${wsPort}`,
      },
    });
  });

  // Apache server-status
  router.get('/server-status', (req: Request, res: Response) => {
    logger.info('Server status accessed', {
      event_type: 'recon_server_status',
      source_ip: req.ip,
    });

    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Apache Status</title></head>
<body>
<h1>Apache Server Status for openclaw.ai</h1>
<p>Server Version: Apache/2.4.52 (Ubuntu)</p>
<p>Server uptime: 14 days 7 hours 23 minutes</p>
<p>Total accesses: 1234567</p>
<!-- Backend: http://${instanceIp}:${httpPort}/api/v1/ -->
<!-- MCP Server: ws://${instanceIp}:${wsPort} -->
</body>
</html>`);
  });

  // GraphQL endpoints (LeakIX probes these)
  const graphqlHandler = (req: Request, res: Response) => {
    logger.info('GraphQL endpoint accessed', {
      event_type: 'graphql_discovery',
      endpoint: req.path,
      method: req.method,
      body: req.body,
      source_ip: req.ip,
    });

    // If introspection query, return a schema that hints at AI capabilities
    if (req.body?.query?.includes('__schema') || req.body?.query?.includes('IntrospectionQuery')) {
      res.json({
        data: {
          __schema: {
            queryType: { name: 'Query' },
            types: [
              { name: 'Query' },
              { name: 'ChatCompletion' },
              { name: 'Model' },
              { name: 'MCPTool' },
              { name: 'Embedding' },
            ],
            directives: [{ name: 'deprecated' }],
          },
        },
      });
    } else {
      res.json({
        errors: [{ message: 'Authentication required' }],
        _hint: {
          rest_api: `http://${instanceIp}:${httpPort}/api/v1/chat`,
          docs: `http://${instanceIp}:${httpPort}/swagger.json`,
        },
      });
    }
  };

  router.all('/graphql', graphqlHandler);
  router.all('/graphql/api', graphqlHandler);
  router.all('/api/graphql', graphqlHandler);
  router.all('/api/gql', graphqlHandler);

  // info.php (common scanner target)
  router.get('/info.php', (req: Request, res: Response) => {
    logger.info('PHP info accessed', {
      event_type: 'recon_phpinfo',
      source_ip: req.ip,
    });

    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>phpinfo()</title></head>
<body>
<h1>PHP Version 8.2.0</h1>
<table>
<tr><td>System</td><td>Linux openclaw-api 5.15.0 x86_64</td></tr>
<tr><td>OPENAI_API_KEY</td><td>sk-proj-clawtrap-phpinfo-****</td></tr>
<tr><td>MCP_SERVER</td><td>ws://${instanceIp}:${wsPort}</td></tr>
<tr><td>API_ENDPOINT</td><td>http://${instanceIp}:${httpPort}/api/v1/</td></tr>
</table>
</body>
</html>`);
  });

  // Security.txt (good practice + breadcrumb)
  router.get('/.well-known/security.txt', (req: Request, res: Response) => {
    logger.info('Security.txt accessed', {
      event_type: 'recon_security_txt',
      source_ip: req.ip,
    });

    res.type('text/plain').send(`Contact: security@openclaw.ai
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://openclaw.ai/.well-known/security.txt

# OpenClaw AI Platform
# Bug bounty: https://openclaw.ai/security/bounty
# API Docs: http://${instanceIp}:${httpPort}/swagger.json
`);
  });

  return router;
}
