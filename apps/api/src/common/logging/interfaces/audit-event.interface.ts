/** Closed set of security-relevant events. Adding one forces handling everywhere it's switched on. */
export type AuditEvent =
  | { event: 'signup'; userId: string }
  | { event: 'signin_success'; userId: string; sessionId: string }
  | { event: 'signin_failed'; email: string; reason: 'unknown_email' | 'wrong_password' }
  | { event: 'lockout'; email: string }
  | { event: 'refresh_reuse_detected'; userId: string; sessionId: string; revokedSessions: number }
  | { event: 'logout'; userId: string; sessionId: string }
  | { event: 'logout_all'; userId: string; revokedSessions: number };

export interface AuditContext {
  ip: string | null;
}
