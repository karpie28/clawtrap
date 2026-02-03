import { Router, Request, Response } from 'express';
import { Config } from '../../config';
import { InjectionDetector } from '../../llm/injection-detector';
import { FakeAgent } from '../../llm/fake-agent';
import { LoggerFactory } from '../../logging';
import { CanaryReporter } from '../../canary/reporter';

const logger = LoggerFactory.getLogger('api');

export function createApiRoutes(config: Config, canaryReporter: CanaryReporter): Router {
  const router = Router();
  const detector = new InjectionDetector(config.detection);
  const fakeAgent = new FakeAgent(config.fake_agent);

  // Main chat endpoint - mimics OpenClaw/ChatGPT API
  router.post('/chat', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();

    try {
      const { message, messages, model, stream } = req.body;
      const userMessage = message || (messages && messages[messages.length - 1]?.content) || '';

      // Detect attack patterns
      const detectedAttacks = detector.detect(userMessage);
      const severity = detectedAttacks.length > 0
        ? Math.max(...detectedAttacks.map(a => getSeverityLevel(a.severity)))
        : 0;

      // Log the interaction
      const logEvent = {
        event_type: 'llm_interaction',
        session_id: sessionId,
        endpoint: '/api/v1/chat',
        user_message: userMessage,
        detected_attacks: detectedAttacks,
        severity: getSeverityName(severity),
        source_ip: req.ip,
        user_agent: req.headers['user-agent'],
        request_model: model,
        stream_requested: Boolean(stream),
        latency_ms: Date.now() - startTime,
      };

      logger.info('LLM interaction captured', logEvent);

      // Check for canary tokens in the message
      if (config.canary.enabled) {
        const canaryMatches = checkForCanaryUsage(userMessage);
        if (canaryMatches.length > 0) {
          await canaryReporter.report({
            type: 'api_key_usage_attempt',
            matches: canaryMatches,
            source_ip: req.ip || 'unknown',
            context: 'chat_message',
          });
        }
      }

      // Generate fake response
      const fakeResponse = await fakeAgent.generateResponse(userMessage, detectedAttacks);

      // Simulate realistic delay
      await randomDelay(config.fake_agent.response_delay_ms);

      if (stream) {
        // Simulate streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const chunks = chunkResponse(fakeResponse);
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
          await randomDelay('50-150');
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.json({
          id: `chatcmpl-${generateId()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: config.fake_agent.model_name,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: fakeResponse,
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: estimateTokens(userMessage),
            completion_tokens: estimateTokens(fakeResponse),
            total_tokens: estimateTokens(userMessage) + estimateTokens(fakeResponse),
          },
        });
      }
    } catch (error) {
      logger.error('Error processing chat request', {
        event_type: 'api_error',
        error: (error as Error).message,
        source_ip: req.ip,
      });

      res.status(500).json({
        error: {
          message: 'An error occurred while processing your request',
          type: 'internal_error',
        },
      });
    }
  });

  // Completions endpoint (legacy)
  router.post('/completions', async (req: Request, res: Response) => {
    const { prompt, model } = req.body;
    const detectedAttacks = detector.detect(prompt || '');

    logger.info('Legacy completions endpoint accessed', {
      event_type: 'llm_interaction',
      endpoint: '/api/v1/completions',
      prompt_preview: (prompt || '').substring(0, 200),
      detected_attacks: detectedAttacks,
      source_ip: req.ip,
    });

    const fakeResponse = await fakeAgent.generateResponse(prompt || '', detectedAttacks);
    await randomDelay(config.fake_agent.response_delay_ms);

    res.json({
      id: `cmpl-${generateId()}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: model || config.fake_agent.model_name,
      choices: [{
        text: fakeResponse,
        index: 0,
        finish_reason: 'stop',
      }],
    });
  });

  // Models endpoint
  router.get('/models', (_req: Request, res: Response) => {
    logger.info('Models endpoint accessed', {
      event_type: 'api_reconnaissance',
      endpoint: '/api/v1/models',
    });

    res.json({
      object: 'list',
      data: [
        { id: 'gpt-4', object: 'model', owned_by: 'openclaw' },
        { id: 'gpt-4-turbo', object: 'model', owned_by: 'openclaw' },
        { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openclaw' },
        { id: 'claude-3-opus', object: 'model', owned_by: 'openclaw' },
        { id: 'claude-3-sonnet', object: 'model', owned_by: 'openclaw' },
      ],
    });
  });

  // Embeddings endpoint
  router.post('/embeddings', (req: Request, res: Response) => {
    const { input } = req.body;

    logger.info('Embeddings endpoint accessed', {
      event_type: 'api_access',
      endpoint: '/api/v1/embeddings',
      input_preview: String(input || '').substring(0, 100),
      source_ip: req.ip,
    });

    // Return fake embeddings
    const fakeEmbedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);

    res.json({
      object: 'list',
      data: [{
        object: 'embedding',
        embedding: fakeEmbedding,
        index: 0,
      }],
      model: 'text-embedding-ada-002',
      usage: {
        prompt_tokens: estimateTokens(String(input || '')),
        total_tokens: estimateTokens(String(input || '')),
      },
    });
  });

  // Files endpoint (potential for malicious uploads)
  router.post('/files', (req: Request, res: Response) => {
    logger.warn('File upload attempted', {
      event_type: 'file_upload_attempt',
      endpoint: '/api/v1/files',
      content_type: req.headers['content-type'],
      source_ip: req.ip,
    });

    res.json({
      id: `file-${generateId()}`,
      object: 'file',
      bytes: 1024,
      created_at: Math.floor(Date.now() / 1000),
      filename: 'uploaded_file.txt',
      purpose: 'assistants',
    });
  });

  // Assistants endpoint
  router.get('/assistants', (_req: Request, res: Response) => {
    logger.info('Assistants endpoint accessed', {
      event_type: 'api_reconnaissance',
      endpoint: '/api/v1/assistants',
    });

    res.json({
      object: 'list',
      data: [{
        id: 'asst_openclaw_main',
        object: 'assistant',
        name: 'OpenClaw Assistant',
        model: 'gpt-4-turbo',
        instructions: 'You are a helpful AI assistant.',
      }],
    });
  });

  // Tools/functions endpoint
  router.post('/tools/:toolName', (req: Request, res: Response) => {
    const { toolName } = req.params;

    logger.warn('Tool execution attempted', {
      event_type: 'tool_abuse_attempt',
      endpoint: `/api/v1/tools/${toolName}`,
      tool_name: toolName,
      body: req.body,
      source_ip: req.ip,
    });

    res.status(403).json({
      error: {
        message: 'Tool execution is restricted',
        type: 'permission_denied',
      },
    });
  });

  return router;
}

// Helper functions
function generateSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getSeverityLevel(severity: string): number {
  const levels: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return levels[severity] || 0;
}

function getSeverityName(level: number): string {
  const names = ['none', 'low', 'medium', 'high', 'critical'];
  return names[level] || 'none';
}

async function randomDelay(range: string): Promise<void> {
  const parts = range.split('-').map(Number);
  const min = parts[0] ?? 0;
  const max = parts[1] ?? min;
  const delay = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

function chunkResponse(text: string): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    currentChunk += (currentChunk ? ' ' : '') + word;
    if (currentChunk.length > 10 || Math.random() > 0.7) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function checkForCanaryUsage(message: string): string[] {
  const canaryPatterns = [
    /sk-proj-clawtrap/gi,
    /sk-ant-api03-clawtrap/gi,
    /AKIACLAWTRAP/gi,
    /clawtrap_secret_/gi,
    /xoxb-clawtrap/gi,
  ];

  const matches: string[] = [];
  for (const pattern of canaryPatterns) {
    const match = message.match(pattern);
    if (match) {
      matches.push(...match);
    }
  }

  return matches;
}
