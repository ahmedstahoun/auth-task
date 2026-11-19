import type { Config } from 'jest';

/** Unit tests: no network, no database, no real clock dependencies. */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': '@swc/jest' },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.model.ts',
    '!src/repositories/schemas/**',
    // Mongo adapters: exercised against a real MongoDB in test/integration.
    '!src/repositories/mongo/**',
    '!src/health/**',
  ],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 },
    './src/auth/': { lines: 90, branches: 90, functions: 90, statements: 90 },
    './src/tokens/': { lines: 90, branches: 90, functions: 90, statements: 90 },
    './src/users/': { lines: 90, branches: 90, functions: 90, statements: 90 },
  },
  // v8 maps through source maps, so SWC's decorator/metadata helpers don't count as branches.
  coverageProvider: 'v8',
  coverageReporters: ['text-summary', 'lcov'],
};

export default config;
