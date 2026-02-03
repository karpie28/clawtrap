import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';

import { Config } from '../config';
import { LoggerFactory } from '../logging';
import { InjectionDetector } from '../llm/injection-detector';
import { FakeAgent } from '../llm/fake-agent';
import { CanaryReporter } from '../canary/reporter';
import { AgentClassifier } from '../detection/agent-classifier';
import { SessionManager, Session } from './session';

const logger = LoggerFactory.getLogger('websocket');

export interface WebSocketGateway {
  close: () => Promise<void>;
}

const MAX_CONNECTIONS_PER_IP = 20;
const CONNECTION_WINDOW_MS = 60_000;

export function createWebSocketGateway(config: Config, canaryReporter: CanaryReporter): WebSocketGateway {
  const wss = new WebSocketServer({ port: config.server.ws_port });
  const detector = new InjectionDetector(config.detection);
  const fakeAgent = new FakeAgent(config.fake_agent);
  const sessionManager = new SessionManager();
  const agentClassifier = new AgentClassifier();

  // Track connection rates per IP for rate limiting
  const connectionCounts = new Map<string, { count: number; resetAt: number }>();

  logger.info(`WebSocket gateway listening on port ${config.server.ws_port}`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const sessionId = uuidv4();
    const clientIp = getClientIp(req);

    // Rate limit connections per IP
    const now = Date.now();
    const ipEntry = connectionCounts.get(clientIp);
    if (ipEntry && now < ipEntry.resetAt) {
      ipEntry.count++;
      if (ipEntry.count > MAX_CONNECTIONS_PER_IP) {
        logger.warn('WebSocket connection rate limited', {
          event_type: 'ws_rate_limited',
          source_ip: clientIp,
          connections_in_window: ipEntry.count,
        });
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
    } else {
      connectionCounts.set(clientIp, { count: 1, resetAt: now + CONNECTION_WINDOW_MS });
    }

    const session = sessionManager.createSession(sessionId, clientIp, {
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
    });

    // Classify on connection
    const connectClassification = agentClassifier.classify({
      userAgent: req.headers['user-agent'],
      ip: clientIp,
      requestHeaders: req.headers as Record<string, string | string[] | undefined>,
    });

    logger.info('WebSocket connection established', {
      event_type: 'ws_connection',
      session_id: sessionId,
      source_ip: clientIp,
      user_agent: req.headers['user-agent'],
      origin: req.headers.origin,
      agent_classification: {
        is_ai_agent: connectClassification.is_ai_agent,
        confidence: connectClassification.confidence,
        signals: connectClassification.signals,
      },
    });

    // Send welcome message
    sendMessage(ws, {
      type: 'connected',
      session_id: sessionId,
      model: config.fake_agent.model_name,
      capabilities: ['chat', 'tools', 'streaming'],
    });

    ws.on('message', async (data: WebSocket.RawData) => {
      try {
        const message = parseMessage(data);
        session.messageCount++;

        logger.info('WebSocket message received', {
          event_type: 'ws_message',
          session_id: sessionId,
          message_type: message.type,
          source_ip: clientIp,
        });

        await handleMessage(ws, session, message, detector, fakeAgent, config, canaryReporter, agentClassifier);
      } catch (error) {
        logger.error('Error processing WebSocket message', {
          event_type: 'ws_error',
          session_id: sessionId,
          error: (error as Error).message,
        });

        sendMessage(ws, {
          type: 'error',
          message: 'Failed to process message',
        });
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const duration = Date.now() - session.startedAt.getTime();

      logger.info('WebSocket connection closed', {
        event_type: 'ws_disconnect',
        session_id: sessionId,
        source_ip: clientIp,
        close_code: code,
        close_reason: reason.toString(),
        session_duration_ms: duration,
        total_messages: session.messageCount,
        detected_attacks: session.detectedAttacks,
      });

      sessionManager.removeSession(sessionId);
    });

    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', {
        event_type: 'ws_error',
        session_id: sessionId,
        error: error.message,
      });
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendMessage(ws, { type: 'ping', timestamp: Date.now() });
      }
    }, 30000);

    ws.on('close', () => clearInterval(heartbeat));
  });

  // Periodically clear stale rate limit entries
  const rateLimitCleanup = setInterval(() => {
    const cutoff = Date.now();
    for (const [ip, entry] of connectionCounts.entries()) {
      if (cutoff >= entry.resetAt) connectionCounts.delete(ip);
    }
  }, CONNECTION_WINDOW_MS);
  rateLimitCleanup.unref();

  return {
    close: () => new Promise((resolve) => {
      clearInterval(rateLimitCleanup);
      sessionManager.close();
      wss.close(() => {
        logger.info('WebSocket gateway closed');
        resolve();
      });
    }),
  };
}

async function handleMessage(
  ws: WebSocket,
  session: Session,
  message: WsMessage,
  detector: InjectionDetector,
  fakeAgent: FakeAgent,
  config: Config,
  canaryReporter: CanaryReporter,
  agentClassifier: AgentClassifier
): Promise<void> {
  switch (message.type) {
    case 'chat':
      await handleChatMessage(ws, session, message, detector, fakeAgent, config, canaryReporter, agentClassifier);
      break;

    case 'tool_call':
      await handleToolCall(ws, session, message);
      break;

    case 'pong':
      // Heartbeat response
      break;

    case 'system':
      await handleSystemMessage(ws, session, message);
      break;

    default:
      logger.warn('Unknown message type', {
        event_type: 'ws_unknown_message',
        session_id: session.id,
        message_type: message.type,
      });
  }
}

async function handleChatMessage(
  ws: WebSocket,
  session: Session,
  message: WsMessage,
  detector: InjectionDetector,
  fakeAgent: FakeAgent,
  config: Config,
  canaryReporter: CanaryReporter,
  agentClassifier: AgentClassifier
): Promise<void> {
  const msgStartTime = Date.now();
  const content = message.content || '';

  // Detect attacks
  const attacks = detector.detect(content);
  if (attacks.length > 0) {
    session.detectedAttacks.push(...attacks);

    logger.warn('Attack detected in WebSocket chat', {
      event_type: 'ws_attack_detected',
      session_id: session.id,
      source_ip: session.clientIp,
      content_preview: content.substring(0, 200),
      detected_attacks: attacks,
    });
  }

  // Check for canary tokens
  if (config.canary.enabled) {
    const canaryPatterns = [
      /sk-proj-clawtrap/gi,
      /sk-ant-api03-clawtrap/gi,
      /AKIACLAWTRAP/gi,
    ];

    for (const pattern of canaryPatterns) {
      if (pattern.test(content)) {
        await canaryReporter.report({
          type: 'canary_in_ws_message',
          session_id: session.id,
          source_ip: session.clientIp,
          context: 'websocket_chat',
        });
        break;
      }
    }
  }

  // Classify whether this is an AI agent (using message content + timing)
  const agentClass = agentClassifier.classify({
    ip: session.clientIp,
    userAgent: session.metadata.userAgent,
    responseContent: content,
    responseTimeMs: Date.now() - msgStartTime,
  });

  // Log the interaction
  logger.info('WebSocket chat message', {
    event_type: 'ws_chat',
    session_id: session.id,
    source_ip: session.clientIp,
    content: content,
    content_length: content.length,
    attacks_detected: attacks.length,
    agent_classification: {
      is_ai_agent: agentClass.is_ai_agent,
      confidence: agentClass.confidence,
      signals: agentClass.signals,
      timing_profile: agentClass.timing_profile,
    },
  });

  // Send typing indicator
  sendMessage(ws, { type: 'typing', session_id: session.id });

  // Generate and stream response
  const response = await fakeAgent.generateResponse(content, attacks);

  if (message.stream !== false) {
    // Stream response word by word
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      await delay(50 + Math.random() * 100);
      sendMessage(ws, {
        type: 'chat_chunk',
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1,
      });
    }
  } else {
    // Send complete response
    await delay(500 + Math.random() * 1500);
    sendMessage(ws, {
      type: 'chat_response',
      content: response,
    });
  }
}

async function handleToolCall(
  ws: WebSocket,
  session: Session,
  message: WsMessage
): Promise<void> {
  const toolName = message.tool_name;
  const toolArgs = message.arguments;

  logger.warn('Tool call attempted via WebSocket', {
    event_type: 'ws_tool_abuse_attempt',
    session_id: session.id,
    source_ip: session.clientIp,
    tool_name: toolName,
    arguments: toolArgs,
  });

  // Simulate tool execution failure
  await delay(200 + Math.random() * 300);

  sendMessage(ws, {
    type: 'tool_error',
    tool_name: toolName,
    error: 'Tool execution is restricted in the current context',
    code: 'PERMISSION_DENIED',
  });
}

async function handleSystemMessage(
  ws: WebSocket,
  session: Session,
  message: WsMessage
): Promise<void> {
  logger.warn('System message injection attempt', {
    event_type: 'ws_system_injection',
    session_id: session.id,
    source_ip: session.clientIp,
    content: message.content,
  });

  sendMessage(ws, {
    type: 'error',
    message: 'System messages cannot be sent by clients',
    code: 'FORBIDDEN',
  });
}

interface WsMessage {
  type: string;
  content?: string;
  tool_name?: string;
  arguments?: Record<string, unknown>;
  stream?: boolean;
  [key: string]: unknown;
}

function parseMessage(data: WebSocket.RawData): WsMessage {
  const str = data.toString();
  try {
    return JSON.parse(str);
  } catch {
    return { type: 'chat', content: str };
  }
}

function sendMessage(ws: WebSocket, message: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = String(forwarded).split(',');
    return ips[0]?.trim() || 'unknown';
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return String(realIp);
  }

  return req.socket.remoteAddress || 'unknown';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
