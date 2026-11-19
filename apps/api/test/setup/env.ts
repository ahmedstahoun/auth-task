import { randomUUID } from 'node:crypto';

// Runs before each test file. Each file gets its own database so files can run in any order.
const baseUri = process.env['MONGO_URI_TEST'] ?? 'mongodb://127.0.0.1:27017';
const url = new URL(baseUri);
url.pathname = `/auth_test_${randomUUID().slice(0, 8)}`;

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGO_URI: url.toString(),
  JWT_ACCESS_SECRET: 'e2e-access-secret-e2e-access-secret-000000',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-e2e-refresh-secret-11111',
  CORS_ORIGINS: 'http://localhost:5173',
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  LOCKOUT_MAX_ATTEMPTS: '5',
});
