import { validateEnv } from './env.schema';

const base = {
  MONGO_URI: 'mongodb://localhost:27017/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGINS: 'http://localhost:5173, https://app.example.com',
};

describe('validateEnv', () => {
  it('applies defaults and parses lists / booleans', () => {
    const env = validateEnv({ ...base, TRUST_PROXY: 'true' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_ACCESS_TTL_SECONDS: 900,
      TRUST_PROXY: true,
      CORS_ORIGINS: ['http://localhost:5173', 'https://app.example.com'],
    });
  });

  it.each([
    ['a missing access secret', { JWT_ACCESS_SECRET: undefined }],
    ['a short secret', { JWT_REFRESH_SECRET: 'short' }],
    ['identical secrets', { JWT_REFRESH_SECRET: 'a'.repeat(32) }],
    ['a non-mongo URI', { MONGO_URI: 'postgres://x' }],
    ['an invalid origin', { CORS_ORIGINS: 'not a url' }],
  ])('fails fast on %s', (_label, override) => {
    expect(() => validateEnv({ ...base, ...override })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('never echoes secret values in the error', () => {
    let message = '';
    try {
      validateEnv({ ...base, JWT_ACCESS_SECRET: 'super-secret-but-short' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toMatch(/JWT_ACCESS_SECRET must be at least 32 characters/);
    expect(message).not.toContain('super-secret-but-short');
  });
});
