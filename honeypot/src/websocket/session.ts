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

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  createSession(id: string, clientIp: string, metadata: SessionMetadata = {}): Session {
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
}
