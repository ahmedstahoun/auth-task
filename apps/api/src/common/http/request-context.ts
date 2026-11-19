import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

export function clientContextFrom(request: Request): ClientContext {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
  };
}

/** Injects the caller's IP / user agent (respects TRUST_PROXY via Express `trust proxy`). */
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientContext =>
  clientContextFrom(ctx.switchToHttp().getRequest<Request>()),
);
