import { Request, Response, NextFunction } from 'express';
import { LoggerFactory } from '../../logging';

const logger = LoggerFactory.getLogger('agent-detect');

export type VisitorType = 'ai_agent' | 'bot' | 'browser' | 'unknown';

declare global {
  namespace Express {
    interface Request {
      visitorType?: VisitorType;
      visitorTypeName?: string;
    }
  }
}

// Known AI crawler / agent User-Agent substrings
const AI_AGENT_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /ChatGPT-User/i, name: 'ChatGPT' },
  { pattern: /GPTBot/i, name: 'GPTBot' },
  { pattern: /ClaudeBot/i, name: 'ClaudeBot' },
  { pattern: /Claude-Web/i, name: 'Claude-Web' },
  { pattern: /anthropic-ai/i, name: 'Anthropic' },
  { pattern: /PerplexityBot/i, name: 'Perplexity' },
  { pattern: /cohere-ai/i, name: 'Cohere' },
  { pattern: /AI2Bot/i, name: 'AI2Bot' },
  { pattern: /YouBot/i, name: 'YouBot' },
  { pattern: /Applebot-Extended/i, name: 'Applebot' },
  { pattern: /Google-Extended/i, name: 'Google-Extended' },
  { pattern: /Bytespider/i, name: 'Bytespider' },
  { pattern: /Diffbot/i, name: 'Diffbot' },
];

// Generic bot patterns (not specifically AI)
const BOT_PATTERNS: RegExp[] = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Puppeteer/i,
  /Playwright/i,
  /python-requests/i,
  /node-fetch/i,
  /Go-http-client/i,
  /axios\//i,
  /curl\//i,
  /httpx/i,
  /aiohttp/i,
  /Scrapy/i,
  /wget/i,
];

/**
 * Middleware that classifies incoming requests into visitor types.
 * Attaches `req.visitorType` for downstream use by UI routes.
 */
export function createAgentDetectMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ua = req.headers['user-agent'] || '';
    const result = classifyVisitor(ua, req.headers);
    req.visitorType = result.type;
    req.visitorTypeName = result.name;

    if (result.type === 'ai_agent') {
      logger.info('AI agent detected', {
        event_type: 'ai_agent_detected',
        visitor_type: result.type,
        visitor_name: result.name,
        source_ip: req.ip,
        user_agent: ua,
        path: req.path,
      });
    }

    next();
  };
}

function classifyVisitor(ua: string, headers: Record<string, string | string[] | undefined>): { type: VisitorType; name?: string } {
  // Check AI agent patterns first (most specific)
  for (const { pattern, name } of AI_AGENT_PATTERNS) {
    if (pattern.test(ua)) {
      return { type: 'ai_agent', name };
    }
  }

  // Heuristic: no UA + programmatic headers = likely AI/bot
  if (!ua.trim()) {
    return { type: 'bot', name: 'empty-ua' };
  }

  // Check generic bot patterns
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      return { type: 'bot', name: pattern.source };
    }
  }

  // Heuristic: missing typical browser headers suggests automation
  const hasAcceptLanguage = !!headers['accept-language'];
  const hasSecHeaders = !!headers['sec-fetch-mode'] || !!headers['sec-ch-ua'];

  if (!hasAcceptLanguage && !hasSecHeaders) {
    // Could be curl/API client - classify as bot
    return { type: 'bot', name: 'no-browser-headers' };
  }

  return { type: 'browser' };
}
