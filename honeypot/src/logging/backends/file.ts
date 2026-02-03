import fs from 'fs';
import path from 'path';
import { LogBackend, LogEntry, Logger } from '../index';

export class FileBackend implements LogBackend {
  private logDir: string;
  private currentFile: string;
  private writeStream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private bufferSize = 100;

  constructor(logDir: string) {
    this.logDir = logDir;
    this.currentFile = this.getLogFileName();
    this.ensureLogDir();
    this.openStream();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `events-${date}.jsonl`);
  }

  private openStream(): void {
    const fileName = this.getLogFileName();

    // Rotate if date changed
    if (fileName !== this.currentFile && this.writeStream) {
      this.writeStream.end();
      this.currentFile = fileName;
    }

    if (!this.writeStream || this.writeStream.destroyed) {
      this.writeStream = fs.createWriteStream(this.currentFile, {
        flags: 'a',
        encoding: 'utf8',
      });
    }
  }

  async write(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    this.buffer.push(line);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    this.openStream();

    const data = this.buffer.join('');
    this.buffer = [];

    return new Promise((resolve, reject) => {
      if (!this.writeStream) {
        reject(new Error('Write stream not initialized'));
        return;
      }

      this.writeStream.write(data, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    await this.flush();

    return new Promise((resolve) => {
      if (this.writeStream) {
        this.writeStream.end(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Simple logger factory for standalone use
export function createLogger(name: string): Logger {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(`[${name}] ${message}`, data || '');
      }
    },
    info: (message: string, data?: Record<string, unknown>) => {
      console.info(`[${name}] ${message}`, data || '');
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      console.warn(`[${name}] ${message}`, data || '');
    },
    error: (message: string, data?: Record<string, unknown>) => {
      console.error(`[${name}] ${message}`, data || '');
    },
  };
}
