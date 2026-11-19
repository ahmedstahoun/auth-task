import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

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

/** Masks the local part of an email so logs stay useful without storing full addresses. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.charAt(0)}***${email.slice(at)}`;
}

@Injectable()
export class AuditLogger {
  constructor(@InjectPinoLogger(AuditLogger.name) private readonly logger: PinoLogger) {}

  record(entry: AuditEvent, context: AuditContext): void {
    const payload = {
      audit: true,
      ...entry,
      ...('email' in entry ? { email: maskEmail(entry.email) } : {}),
      ip: context.ip,
    };
    const message = `audit:${entry.event}`;

    switch (entry.event) {
      case 'refresh_reuse_detected':
      case 'lockout':
      case 'signin_failed':
        this.logger.warn(payload, message);
        return;
      case 'signup':
      case 'signin_success':
      case 'logout':
      case 'logout_all':
        this.logger.info(payload, message);
        return;
    }
  }
}
