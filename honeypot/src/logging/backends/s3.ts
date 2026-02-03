import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { LogBackend, LogEntry } from '../index';

const gzipAsync = promisify(gzip);

export class S3Backend implements LogBackend {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  private buffer: LogEntry[] = [];
  private bufferSize = 1000;
  private flushIntervalMs = 60000; // 1 minute
  private lastFlush: number = Date.now();

  constructor(bucket: string, prefix?: string) {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucket = bucket;
    this.prefix = prefix || 'clawtrap-logs';
  }

  async write(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);

    const shouldFlush =
      this.buffer.length >= this.bufferSize ||
      Date.now() - this.lastFlush >= this.flushIntervalMs;

    if (shouldFlush) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];
    this.lastFlush = Date.now();

    const key = this.generateKey();
    const content = entries.map(e => JSON.stringify(e)).join('\n');

    try {
      // Compress the content
      const compressed = await gzipAsync(Buffer.from(content, 'utf-8'));

      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: compressed,
        ContentType: 'application/x-ndjson',
        ContentEncoding: 'gzip',
        Metadata: {
          'event-count': entries.length.toString(),
          'instance-id': process.env.CLAWTRAP_INSTANCE_ID || 'local',
        },
      }));
    } catch (error) {
      console.error('Failed to upload logs to S3:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  private generateKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    const timestamp = now.getTime();
    const instanceId = process.env.CLAWTRAP_INSTANCE_ID || 'local';

    return `${this.prefix}/year=${year}/month=${month}/day=${day}/hour=${hour}/${instanceId}-${timestamp}.jsonl.gz`;
  }

  async close(): Promise<void> {
    await this.flush();
  }
}
