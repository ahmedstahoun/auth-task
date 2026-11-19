import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AuditContext, AuditEvent } from './interfaces/audit-event.interface';

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
