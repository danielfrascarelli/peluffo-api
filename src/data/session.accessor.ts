import { Injectable } from "@nestjs/common";

// One login = one session (refresh token family). Only the latest refresh token of a family is valid.
export interface Session {
  userId: string;
  currentJti: string;
  expiresAt: number;
}

// ponytail: in-process Map. Sessions end on restart and are not shared between instances.
// Move to a table or Redis before running more than one instance.
@Injectable()
export class SessionAccessor {
  private readonly sessions = new Map<string, Session>();

  get(family: string): Session | undefined {
    const session = this.sessions.get(family);
    if (session && session.expiresAt <= Date.now()) {
      this.sessions.delete(family);
      return undefined;
    }
    return session;
  }

  set(family: string, session: Session): void {
    const now = Date.now();
    for (const [key, s] of this.sessions) if (s.expiresAt <= now) this.sessions.delete(key);
    this.sessions.set(family, session);
  }

  delete(family: string): void {
    this.sessions.delete(family);
  }
}
