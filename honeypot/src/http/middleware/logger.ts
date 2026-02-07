import { Request, Response, NextFunction } from 'express';
import { TLSSocket } from 'tls';
import { Config } from '../../config';
import { LoggerFactory } from '../../logging';

const logger = LoggerFactory.getLogger('http-access');

// Track request timing per IP for inter-request interval analysis
const ipTimingTracker = new Map<string, { lastRequest: bigint; requestCount: number; paths: string[] }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = process.hrtime.bigint() - BigInt(5 * 60 * 1e9);
  for (const [ip, data] of ipTimingTracker.entries()) {
    if (data.lastRequest < fiveMinutesAgo) {
      ipTimingTracker.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function createLoggerMiddleware(config: Config) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startHrTime = process.hrtime.bigint(); // High-resolution timing

    // Capture request body for POST/PUT requests
    const requestBody = req.body && Object.keys(req.body).length > 0
      ? sanitizeBody(req.body)
      : undefined;

    // Log when response finishes
    res.on('finish', () => {
      const endHrTime = process.hrtime.bigint();
      const duration = Date.now() - startTime;
      const durationNs = Number(endHrTime - startHrTime);
      const durationMs = durationNs / 1e6; // Precise milliseconds

      const clientIp = getClientIp(req);

      // Track inter-request timing for this IP
      const timingData = getIpTimingData(clientIp, endHrTime, req.path);

      // Extract TLS fingerprint if available
      const tlsInfo = extractTlsInfo(req);

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
          ip: clientIp,
          user_agent: req.headers['user-agent'],
          referer: req.headers.referer,
          origin: req.headers.origin,
        },

        response: {
          status_code: res.statusCode,
          duration_ms: duration,
          duration_precise_ms: Math.round(durationMs * 1000) / 1000, // 3 decimal places
        },

        // Enhanced timing for scanner pattern analysis
        timing: {
          inter_request_interval_ms: timingData.intervalMs,
          request_sequence_num: timingData.requestCount,
          recent_paths: timingData.recentPaths,
        },

        // TLS fingerprinting
        tls: tlsInfo,

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

function getIpTimingData(ip: string, currentTime: bigint, path: string): {
  intervalMs: number | null;
  requestCount: number;
  recentPaths: string[];
} {
  const existing = ipTimingTracker.get(ip);

  if (existing) {
    const intervalNs = Number(currentTime - existing.lastRequest);
    const intervalMs = Math.round(intervalNs / 1e6 * 1000) / 1000; // 3 decimal places

    // Update tracker
    existing.lastRequest = currentTime;
    existing.requestCount++;
    existing.paths.push(path);
    if (existing.paths.length > 20) {
      existing.paths.shift(); // Keep last 20 paths
    }

    return {
      intervalMs,
      requestCount: existing.requestCount,
      recentPaths: existing.paths.slice(-5), // Return last 5 for log
    };
  } else {
    // First request from this IP
    ipTimingTracker.set(ip, {
      lastRequest: currentTime,
      requestCount: 1,
      paths: [path],
    });

    return {
      intervalMs: null, // No previous request to compare
      requestCount: 1,
      recentPaths: [path],
    };
  }
}

function extractTlsInfo(req: Request): Record<string, unknown> | undefined {
  const socket = req.socket as TLSSocket;

  // Only available for TLS connections
  if (!socket.encrypted) {
    return undefined;
  }

  try {
    const cipher = socket.getCipher?.();
    const protocol = socket.getProtocol?.();

    return {
      protocol: protocol,
      cipher_name: cipher?.name,
      cipher_version: cipher?.version,
      // Note: Full JA3/JA4 fingerprinting would require raw TLS handshake capture
      // which isn't available at this layer. Consider using a TLS termination proxy.
    };
  } catch {
    return undefined;
  }
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
