import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { AuditLogger } from '../../src/common/logging/audit-logger.service';
import { AppConfig } from '../../src/config/app-config';
import type { Env } from '../../src/config/env.schema';
import type { SessionStore } from '../../src/sessions/session-store';
import { buildEnv } from './factories';

/** A real AppConfig backed by a plain Env object — no process.env involved. */
export function mockConfig(overrides: Partial<Env> = {}): AppConfig {
  return new AppConfig(new ConfigService<Env, true>(buildEnv(overrides)));
}

export function mockPinoLogger(): DeepMocked<PinoLogger> {
  return createMock<PinoLogger>();
}

export function mockAuditLogger(): DeepMocked<AuditLogger> {
  return createMock<AuditLogger>();
}

export function mockSessionStore(): DeepMocked<SessionStore> {
  return createMock<SessionStore>();
}
