import type { NewSession, RotationResult, Session } from '../models/session.model';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export interface SessionsRepository {
  create(session: NewSession): Promise<Session>;
  /** Returns the session only if it exists and has not expired. */
  findActive(sessionId: string): Promise<Session | null>;
  /** Atomically swaps the allowed refresh jti. Exactly one concurrent caller can win. */
  rotate(sessionId: string, presentedJti: string, nextJti: string): Promise<RotationResult>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
  listActiveForUser(userId: string): Promise<Session[]>;
}
