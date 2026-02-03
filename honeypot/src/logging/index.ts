import pino from 'pino';
import { LoggingConfig } from '../config';
import { FileBackend } from './backends/file';
import { S3Backend } from './backends/s3';
import { GeoEnricher } from './enricher';

export interface LogBackend {
  write(entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

class ClawTrapLogger implements Logger {
  private name: string;
  private pino: pino.Logger;

  constructor(name: string, pinoLogger: pino.Logger) {
    this.name = name;
    this.pino = pinoLogger.child({ component: name });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.pino.debug(data || {}, message);
    LoggerFactory.writeToBackend('debug', message, { component: this.name, ...data });
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.pino.info(data || {}, message);
    LoggerFactory.writeToBackend('info', message, { component: this.name, ...data });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.pino.warn(data || {}, message);
    LoggerFactory.writeToBackend('warn', message, { component: this.name, ...data });
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.pino.error(data || {}, message);
    LoggerFactory.writeToBackend('error', message, { component: this.name, ...data });
  }
}

const MAX_QUEUE_SIZE = 50_000;

export class LoggerFactory {
  private static backend: LogBackend | null = null;
  private static enricher: GeoEnricher | null = null;
  private static config: LoggingConfig | null = null;
  private static pino: pino.Logger;
  private static loggers: Map<string, Logger> = new Map();
  private static writeQueue: LogEntry[] = [];
  private static flushInterval: NodeJS.Timeout | null = null;
  private static droppedEntries = 0;

  static {
    // Initialize pino with pretty printing for development
    this.pino = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    });
  }

  static async initialize(config: LoggingConfig): Promise<void> {
    this.config = config;

    // Initialize geo enricher if enabled
    if (config.enrichment?.geo || config.enrichment?.asn) {
      this.enricher = new GeoEnricher();
      await this.enricher.initialize();
    }

    // Initialize backend based on config
    switch (config.backend) {
      case 'file':
        this.backend = new FileBackend(config.file_path || './logs');
        break;
      case 's3':
        this.backend = new S3Backend(config.s3_bucket || 'clawtrap-logs');
        break;
      default:
        this.backend = new FileBackend('./logs');
    }

    // Start flush interval
    this.flushInterval = setInterval(() => this.flush(), 5000);

    this.pino.info({ backend: config.backend }, 'Logging backend initialized');
  }

  static getLogger(name: string): Logger {
    let logger = this.loggers.get(name);
    if (!logger) {
      logger = new ClawTrapLogger(name, this.pino);
      this.loggers.set(name, logger);
    }
    return logger;
  }

  static async writeToBackend(
    level: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!this.backend) return;

    let enrichedData = data;

    // Enrich with geo data if source IP is present
    if (this.enricher && data?.source_ip) {
      const geoData = await this.enricher.enrich(String(data.source_ip));
      if (geoData) {
        enrichedData = {
          ...data,
          source: {
            ...((data.source as Record<string, unknown>) || {}),
            ip: data.source_ip,
            geo: geoData.geo,
            asn: geoData.asn,
          },
        };
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...enrichedData,
    };

    // Drop oldest entries if queue is at capacity
    if (this.writeQueue.length >= MAX_QUEUE_SIZE) {
      const dropCount = Math.floor(MAX_QUEUE_SIZE * 0.1);
      this.writeQueue.splice(0, dropCount);
      this.droppedEntries += dropCount;
      this.pino.warn({ dropped: dropCount, total_dropped: this.droppedEntries }, 'Log queue at capacity, dropping oldest entries');
    }

    this.writeQueue.push(entry);

    // Immediate flush for errors and warnings
    if (level === 'error' || level === 'warn') {
      await this.flush();
    }
  }

  static async flush(): Promise<void> {
    if (!this.backend || this.writeQueue.length === 0) return;

    const entries = [...this.writeQueue];
    this.writeQueue = [];

    for (const entry of entries) {
      try {
        await this.backend.write(entry);
      } catch (error) {
        this.pino.error({ error: (error as Error).message }, 'Failed to write log entry');
      }
    }

    await this.backend.flush();
  }

  static async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();

    if (this.backend) {
      await this.backend.close();
    }
  }
}

// Re-export for convenience
export { createLogger } from './backends/file';
