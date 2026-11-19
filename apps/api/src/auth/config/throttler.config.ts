import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { AppConfig } from '../../config/app-config';
import { AUTH_RATE_LIMITED } from '../constants/auth.constants';

const ONE_MINUTE_MS = 60_000;

export function buildThrottlerOptions(config: AppConfig): ThrottlerModuleOptions {
  const reflector = new Reflector();
  const isAuthRoute = (context: ExecutionContext): boolean =>
    reflector.get<boolean | undefined>(AUTH_RATE_LIMITED, context.getHandler()) === true;

  return {
    throttlers: [
      { name: 'default', ttl: ONE_MINUTE_MS, limit: 100 },
      {
        name: 'auth',
        ttl: ONE_MINUTE_MS,
        limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE'),
        skipIf: (context) => !isAuthRoute(context),
      },
    ],
  };
}
