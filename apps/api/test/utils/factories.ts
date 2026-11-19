import { randomUUID } from 'node:crypto';
import type { SignInInput, SignUpInput, UserDto } from '@auth/shared';
import { Types } from 'mongoose';
import type { ClientContext } from '../../src/common/http/request-context';
import type { Env } from '../../src/config/env.schema';
import type { SessionRecord } from '../../src/sessions/session-store';

/** A complete, valid Env for tests. Secrets are test-only values. */
export function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    MONGO_URI: 'mongodb://127.0.0.1:27017/test',
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0000',
    JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-111',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604_800,
    JWT_ISSUER: 'auth-task-api',
    JWT_AUDIENCE: 'auth-task-web',
    CORS_ORIGINS: ['http://localhost:5173'],
    TRUST_PROXY: false,
    AUTH_RATE_LIMIT_PER_MINUTE: 5,
    LOCKOUT_MAX_ATTEMPTS: 5,
    LOCKOUT_WINDOW_SECONDS: 900,
    ...overrides,
  };
}

export function buildUserDto(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: new Types.ObjectId().toHexString(),
    email: 'jane@example.com',
    name: 'Jane Doe',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

export function buildSignUpInput(overrides: Partial<SignUpInput> = {}): SignUpInput {
  return { email: 'jane@example.com', name: 'Jane Doe', password: 'Str0ng!pass', ...overrides };
}

export function buildSignInInput(overrides: Partial<SignInInput> = {}): SignInInput {
  return { email: 'jane@example.com', password: 'Str0ng!pass', ...overrides };
}

export function buildSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: new Types.ObjectId().toHexString(),
    userAgent: 'jest',
    ip: '127.0.0.1',
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...overrides,
  };
}

export function buildClient(overrides: Partial<ClientContext> = {}): ClientContext {
  return { ip: '127.0.0.1', userAgent: 'jest', ...overrides };
}
