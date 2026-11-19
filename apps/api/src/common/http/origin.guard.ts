import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config';

/**
 * CSRF defence for cookie-authenticated endpoints (refresh / logout), on top of SameSite=Strict:
 * the browser-set Origin header must be one of the allowed web origins.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: ReadonlySet<string>;

  constructor(config: AppConfig) {
    this.allowed = new Set(config.get('CORS_ORIGINS'));
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().get('origin');
    if (origin === undefined || !this.allowed.has(origin)) {
      throw new ForbiddenException('Origin not allowed');
    }
    return true;
  }
}
