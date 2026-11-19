/** A server-side login session (one per device / sign-in). */
export interface SessionRecord {
  id: string;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

export interface NewSession {
  id: string;
  userId: string;
  /** jti of the refresh token currently allowed to rotate this session. Stored hashed. */
  refreshJti: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
}

export type RotationResult =
  | { status: 'rotated'; session: SessionRecord }
  /** A valid but already-used refresh token was presented: treat as theft. */
  | { status: 'reuse_detected'; userId: string }
  | { status: 'not_found' };

/**
 * Persistence port for sessions and brute-force counters. The Mongo implementation uses TTL
 * indexes; a Redis implementation can replace it without touching the auth logic.
 * Abstract class (not interface) so it can act as the DI token.
 */
export abstract class SessionStore {
  abstract create(session: NewSession): Promise<SessionRecord>;
  abstract findActive(sessionId: string): Promise<SessionRecord | null>;
  /** Atomically swaps the allowed refresh jti. Exactly one concurrent caller can win. */
  abstract rotate(
    sessionId: string,
    presentedJti: string,
    nextJti: string,
  ): Promise<RotationResult>;
  abstract revoke(sessionId: string): Promise<void>;
  abstract revokeAllForUser(userId: string): Promise<number>;
  abstract listActiveForUser(userId: string): Promise<SessionRecord[]>;

  /** Returns the failure count within the current window (window starts at the first failure). */
  abstract registerFailedLogin(email: string, windowSeconds: number): Promise<number>;
  abstract countFailedLogins(email: string): Promise<number>;
  abstract clearFailedLogins(email: string): Promise<void>;
}
