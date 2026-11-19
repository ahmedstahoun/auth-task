import type { Config } from 'jest';

/** Integration + e2e: real MongoDB (mongodb-memory-server) and the full HTTP pipeline. */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
  transform: { '^.+\\.ts$': '@swc/jest' },
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  testTimeout: 30_000,
  // Report (instead of silently waiting on) anything that keeps the process alive after the run.
  detectOpenHandles: true,
};

export default config;
