import type { CookieOptions, Request, Response } from 'express';

const COOKIE_PATH = '/auth';

/** `__Secure-` prefix makes browsers refuse the cookie unless it is Secure (HTTPS). */
export function refreshCookieName(isProduction: boolean): string {
  return isProduction ? '__Secure-refresh_token' : 'refresh_token';
}

function baseOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: 'strict', path: COOKIE_PATH };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  isProduction: boolean,
): void {
  res.cookie(refreshCookieName(isProduction), token, {
    ...baseOptions(isProduction),
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(refreshCookieName(isProduction), baseOptions(isProduction));
}

export function readRefreshCookie(req: Request, isProduction: boolean): string | null {
  // cookie-parser types `cookies` as Record<string, any>; narrow before use.
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return null;
  const value: unknown = Reflect.get(cookies, refreshCookieName(isProduction));
  return typeof value === 'string' && value.length > 0 ? value : null;
}
