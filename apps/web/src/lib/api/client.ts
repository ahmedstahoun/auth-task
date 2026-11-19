import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { authResponseSchema, type AuthResponse } from '@auth/shared';
import { env } from '@/env';
import { tokenStore } from './token-store';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** Set once a request has been retried after a token refresh. */
    _retried?: boolean;
  }
}

/** Endpoints that must never trigger an automatic refresh (would loop or mask real errors). */
const NO_REFRESH_PATHS = ['/auth/signin', '/auth/signup', '/auth/refresh', '/auth/logout'];

export const api = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true, // send the httpOnly refresh cookie to /auth/*
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

type SessionListener = (session: AuthResponse | null) => void;
const listeners = new Set<SessionListener>();

/** Lets the AuthProvider react to refreshes / expiry that happen inside the client. */
export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(session: AuthResponse | null): void {
  tokenStore.set(session?.accessToken ?? null);
  for (const listener of listeners) listener(session);
}

let inFlightRefresh: Promise<AuthResponse | null> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share ONE request:
 * firing two refreshes with the same cookie would look like token reuse to the server and
 * revoke every session (this also covers React StrictMode's double effects in dev).
 */
export function refreshSession(): Promise<AuthResponse | null> {
  inFlightRefresh ??= api
    .post<unknown>('/auth/refresh')
    .then((res) => {
      const session = authResponseSchema.parse(res.data);
      publish(session);
      return session;
    })
    .catch(() => {
      publish(null);
      return null;
    })
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}

export function setSession(session: AuthResponse | null): void {
  publish(session);
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

function shouldRefresh(
  error: AxiosError,
): error is AxiosError & { config: InternalAxiosRequestConfig } {
  const { config, response } = error;
  if (response?.status !== 401 || !config || config._retried === true) return false;
  return !NO_REFRESH_PATHS.some((path) => config.url?.endsWith(path) ?? false);
}

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || !shouldRefresh(error)) throw error;

  const session = await refreshSession();
  if (!session) throw error;

  error.config._retried = true;
  return api.request(error.config);
});
