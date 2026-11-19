import type { ApiError, AuthResponse, UserDto } from '@auth/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = 'http://localhost:3000';

export const user: UserDto = {
  id: '665f1f77bcf86cd799439011',
  email: 'jane@example.com',
  name: 'Jane Doe',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function authResponse(token = 'access-1'): AuthResponse {
  return { accessToken: token, expiresIn: 900, user };
}

export function apiError(
  statusCode: number,
  message: string,
  extra: Partial<ApiError> = {},
): ApiError {
  return {
    statusCode,
    error: 'Error',
    message,
    path: '/',
    timestamp: new Date().toISOString(),
    requestId: '00000000-0000-4000-8000-000000000000',
    ...extra,
  };
}

/** Default: anonymous visitor (no refresh cookie). Tests override per scenario. */
export const handlers = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json(apiError(401, 'Missing refresh token'), { status: 401 }),
  ),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);
