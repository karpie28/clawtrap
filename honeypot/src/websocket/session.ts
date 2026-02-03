import { DetectedAttack } from '../llm/injection-detector';

export interface Session {
  id: string;
  clientIp: string;
  startedAt: Date;
  messageCount: number;
  detectedAttacks: DetectedAttack[];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  userAgent?: string;
  origin?: string;
  [key: string]: unknown;
}

const DEFAULT_MAX_SESSIONS = 10000;
const DEFAULT_CLEANUP_INTERVAL_MS = 60_000;
const DEFAULT_MAX_SESSION_AGE_MS = 3_600_000; // 1 hour

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private maxSessions: number;
  private maxSessionAgeMs: number;

  constructor(opts?: { maxSessions?: number; maxSessionAgeMs?: number; cleanupIntervalMs?: number }) {
    this.maxSessions = opts?.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxSessionAgeMs = opts?.maxSessionAgeMs ?? DEFAULT_MAX_SESSION_AGE_MS;

    const interval = opts?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    this.cleanupTimer = setInterval(() => this.cleanupOldSessions(this.maxSessionAgeMs), interval);
    this.cleanupTimer.unref();
  }

  createSession(id: string, clientIp: string, metadata: SessionMetadata = {}): Session {
    // Evict oldest sessions if at capacity
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest(Math.floor(this.maxSessions * 0.1));
    }

    const session: Session = {
      id,
      clientIp,
      startedAt: new Date(),
      messageCount: 0,
      detectedAttacks: [],
      metadata,
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): Session[] {
    return this.getAllSessions();
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionsByIp(ip: string): Session[] {
    return this.getAllSessions().filter(s => s.clientIp === ip);
  }

  getSessionsWithAttacks(): Session[] {
    return this.getAllSessions().filter(s => s.detectedAttacks.length > 0);
  }

  cleanupOldSessions(maxAgeMs: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.startedAt.getTime() > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private evictOldest(count: number): void {
    const sorted = [...this.sessions.entries()]
      .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime());

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      this.sessions.delete(sorted[i]![0]);
    }
  }
}
