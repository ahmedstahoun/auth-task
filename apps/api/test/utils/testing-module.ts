import type { Provider, Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AuditLogger } from '../../src/common/logging/audit-logger.service';
import { AppConfig } from '../../src/config/app-config';
import type { Env } from '../../src/config/env.schema';
import { mockAuditLogger, mockConfig, mockPinoLogger } from './mocks';

interface TestingModuleOptions {
  /** Real classes under test. */
  providers: Type[];
  /** Collaborators, usually typed mocks: `{ provide: SessionStore, useValue: mockSessionStore() }`. */
  overrides?: Provider[];
  env?: Partial<Env>;
}

/**
 * Builds a Nest testing module with the cross-cutting providers (config, loggers) pre-mocked,
 * so each spec only declares what it actually cares about.
 */
export async function createTestingModule(options: TestingModuleOptions): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      ...options.providers,
      { provide: AppConfig, useValue: mockConfig(options.env) },
      { provide: PinoLogger, useValue: mockPinoLogger() },
      { provide: AuditLogger, useValue: mockAuditLogger() },
      ...(options.overrides ?? []),
    ],
  }).compile();
}
