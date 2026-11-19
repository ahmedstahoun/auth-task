import { describe, expect, it } from 'vitest';
import { authResponseSchema, isApiError } from './contracts';

describe('isApiError', () => {
  const error = {
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Invalid credentials',
    path: '/auth/signin',
    timestamp: new Date().toISOString(),
    requestId: 'b9f0c1a2-0000-4000-8000-000000000000',
  };

  it('accepts the API error shape', () => {
    expect(isApiError(error)).toBe(true);
    expect(isApiError({ ...error, details: { email: ['Enter a valid email address'] } })).toBe(
      true,
    );
  });

  it.each([null, undefined, 'error', 42, {}, { ...error, statusCode: '401' }])(
    'rejects %j',
    (value) => {
      expect(isApiError(value)).toBe(false);
    },
  );
});

describe('authResponseSchema', () => {
  it('rejects a response without an access token', () => {
    const result = authResponseSchema.safeParse({
      expiresIn: 900,
      user: { id: '1', email: 'a@b.co', name: 'Jane', createdAt: new Date().toISOString() },
    });
    expect(result.success).toBe(false);
  });
});
