import https from 'https';
import http from 'http';
import { URL } from 'url';
import { CanaryConfig } from '../config';
import { LoggerFactory } from '../logging';

const logger = LoggerFactory.getLogger('canary-reporter');

export interface CanaryEvent {
  type: string;
  token_type?: string;
  token_value?: string;
  source_ip: string;
  context: string;
  session_id?: string;
  matches?: string[];
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface CanaryReport {
  event_type: 'canary_triggered';
  timestamp: string;
  canary: {
    id?: string;
    type: string;
    trigger_context: string;
  };
  source: {
    ip: string;
    session_id?: string;
  };
  details: Record<string, unknown>;
}

export class CanaryReporter {
  private config: CanaryConfig;
  private reportQueue: CanaryReport[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: CanaryConfig) {
    this.config = config;

    if (config.enabled) {
      // Flush queue every 5 seconds
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  async report(event: CanaryEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const report: CanaryReport = {
      event_type: 'canary_triggered',
      timestamp: event.timestamp || new Date().toISOString(),
      canary: {
        id: this.extractCanaryId(event.token_value),
        type: event.type,
        trigger_context: event.context,
      },
      source: {
        ip: event.source_ip,
        session_id: event.session_id,
      },
      details: {
        token_type: event.token_type,
        matches: event.matches,
        ...event.metadata,
      },
    };

    // Log locally
    logger.warn('Canary token triggered', report as unknown as Record<string, unknown>);

    // Queue for callback
    this.reportQueue.push(report);

    // Immediate flush for high-priority events
    if (this.isHighPriority(event)) {
      await this.flush();
    }
  }

  private isHighPriority(event: CanaryEvent): boolean {
    const highPriorityTypes = [
      'canary_credential_used',
      'aws_key_usage',
      'api_key_external_usage',
    ];
    return highPriorityTypes.includes(event.type);
  }

  private extractCanaryId(tokenValue?: string): string | undefined {
    if (!tokenValue) return undefined;

    const patterns = [
      /clawtrap([a-zA-Z0-9]{8})/i,
      /CLAWTRAP:([^:]+):/,
    ];

    for (const pattern of patterns) {
      const match = tokenValue.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  async flush(): Promise<void> {
    if (this.reportQueue.length === 0) {
      return;
    }

    const reports = [...this.reportQueue];
    this.reportQueue = [];

    // Send to callback URL if configured
    if (this.config.callback_url) {
      await this.sendToCallback(reports);
    }

    // Could also send to AWS Lambda, etc.
  }

  private async sendToCallback(reports: CanaryReport[]): Promise<void> {
    if (!this.config.callback_url) return;

    try {
      const url = new URL(this.config.callback_url);
      const isHttps = url.protocol === 'https:';

      const payload = JSON.stringify({
        reports,
        batch_size: reports.length,
        sent_at: new Date().toISOString(),
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'ClawTrap-Canary-Reporter/1.0',
        },
      };

      await new Promise<void>((resolve, reject) => {
        const lib = isHttps ? https : http;
        const req = lib.request(options, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            logger.debug('Canary reports sent successfully', {
              count: reports.length,
              status: res.statusCode,
            });
            resolve();
          } else {
            logger.warn('Canary callback returned non-success status', {
              status: res.statusCode,
              count: reports.length,
            });
            resolve(); // Don't reject, just log
          }
        });

        req.on('error', (error) => {
          logger.error('Failed to send canary reports', {
            error: error.message,
            count: reports.length,
          });
          resolve(); // Don't reject, just log
        });

        req.setTimeout(10000, () => {
          req.destroy();
          logger.warn('Canary callback request timed out');
          resolve();
        });

        req.write(payload);
        req.end();
      });
    } catch (error) {
      logger.error('Error sending canary reports', {
        error: (error as Error).message,
      });
    }
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();
  }

  getQueueSize(): number {
    return this.reportQueue.length;
  }
}
