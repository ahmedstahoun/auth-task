/**
 * The access token lives only in memory (this module). It is never written to localStorage or
 * sessionStorage, so an XSS payload cannot simply read it from storage, and it disappears when the
 * tab closes. The long-lived refresh token is an httpOnly cookie that JavaScript cannot read.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
};
