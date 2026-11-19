import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { AuditLogger } from '../../src/common/logging/audit-logger.service';
import { AppConfig } from '../../src/config/app-config';
import type { Env } from '../../src/config/env.schema';
import type { LoginAttemptsRepository } from '../../src/repositories/interfaces/login-attempts-repository.interface';
import type { SessionsRepository } from '../../src/repositories/interfaces/sessions-repository.interface';
import type { UsersRepository } from '../../src/repositories/interfaces/users-repository.interface';
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

export function mockUsersRepository(): DeepMocked<UsersRepository> {
  return createMock<UsersRepository>();
}

export function mockSessionsRepository(): DeepMocked<SessionsRepository> {
  return createMock<SessionsRepository>();
}

export function mockLoginAttemptsRepository(): DeepMocked<LoginAttemptsRepository> {
  return createMock<LoginAttemptsRepository>();
}
