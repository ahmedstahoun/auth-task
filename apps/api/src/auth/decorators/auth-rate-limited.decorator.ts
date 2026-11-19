import { SetMetadata } from '@nestjs/common';
import { AUTH_RATE_LIMITED } from '../constants/auth.constants';

/** Marks credential endpoints (sign-in / sign-up) for the strict per-IP "auth" throttler. */
export const AuthRateLimited = (): MethodDecorator => SetMetadata(AUTH_RATE_LIMITED, true);
