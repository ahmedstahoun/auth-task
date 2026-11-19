import type { Request, Response } from 'express';
import {
  clearRefreshCookie,
  readRefreshCookie,
  refreshCookieName,
  setRefreshCookie,
} from './refresh-cookie';

describe('refresh cookie', () => {
  it('uses the __Secure- prefix in production only', () => {
    expect(refreshCookieName(true)).toBe('__Secure-refresh_token');
    expect(refreshCookieName(false)).toBe('refresh_token');
  });

  it('sets an httpOnly, SameSite=Strict cookie scoped to /auth', () => {
    const cookie = jest.fn();
    const expires = new Date();
    setRefreshCookie({ cookie } as unknown as Response, 'tok', expires, true);
    expect(cookie).toHaveBeenCalledWith('__Secure-refresh_token', 'tok', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      expires,
    });
  });

  it('clears with matching attributes (otherwise browsers keep the cookie)', () => {
    const clearCookie = jest.fn();
    clearRefreshCookie({ clearCookie } as unknown as Response, false);
    expect(clearCookie).toHaveBeenCalledWith('refresh_token', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/auth',
    });
  });

  it.each([
    [{ refresh_token: 'tok' }, 'tok'],
    [{ refresh_token: '' }, null],
    [{ refresh_token: ['a'] }, null],
    [{}, null],
    [undefined, null],
  ])('reads %p as %p', (cookies, expected) => {
    expect(readRefreshCookie({ cookies } as Request, false)).toBe(expected);
  });
});
