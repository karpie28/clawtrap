import { Request, Response, NextFunction } from 'express';
import { Config } from '../../config';
import { LoggerFactory } from '../../logging';

const logger = LoggerFactory.getLogger('http-access');

export function createLoggerMiddleware(config: Config) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture request body for POST/PUT requests
    const requestBody = req.body && Object.keys(req.body).length > 0
      ? sanitizeBody(req.body)
      : undefined;

    // Log when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const logEntry = {
        event_type: 'http_request',
        timestamp: new Date().toISOString(),
        instance_id: config.instance_id,

        request: {
          method: req.method,
          path: req.path,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          body: requestBody,
          content_type: req.headers['content-type'],
          content_length: req.headers['content-length'],
        },

        source: {
          ip: getClientIp(req),
          user_agent: req.headers['user-agent'],
          referer: req.headers.referer,
          origin: req.headers.origin,
        },

        response: {
          status_code: res.statusCode,
          duration_ms: duration,
        },

        headers: extractInterestingHeaders(req.headers),
      };

      // Log level based on status code
      if (res.statusCode >= 500) {
        logger.error('HTTP request completed with error', logEntry);
      } else if (res.statusCode >= 400) {
        logger.warn('HTTP request completed with client error', logEntry);
      } else {
        logger.info('HTTP request completed', logEntry);
      }
    });

    next();
  };
}

function getClientIp(req: Request): string {
  // Check various headers for the real IP (in case of proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = String(forwarded).split(',');
    return ips[0]?.trim() || req.ip || 'unknown';
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return String(realIp);
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'api_key', 'apiKey', 'secret', 'token', 'credential'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      // For sensitive fields, only log length and type
      sanitized[key] = {
        _redacted: true,
        length: typeof value === 'string' ? value.length : undefined,
        type: typeof value,
      };
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 500) + '... [truncated]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function extractInterestingHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const interesting = [
    'accept',
    'accept-language',
    'accept-encoding',
    'connection',
    'host',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'x-requested-with',
    'x-api-key',
    'x-client-version',
  ];

  const extracted: Record<string, unknown> = {};

  for (const header of interesting) {
    if (headers[header]) {
      extracted[header] = headers[header];
    }
  }

  return extracted;
}
