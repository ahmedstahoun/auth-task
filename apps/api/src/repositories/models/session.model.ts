/** A server-side login session (one per device / sign-in). */
export interface Session {
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
  | { status: 'rotated'; session: Session }
  /** A valid but already-used refresh token was presented: treat as theft. */
  | { status: 'reuse_detected'; userId: string }
  | { status: 'not_found' };
