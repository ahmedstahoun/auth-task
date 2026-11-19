import type { AuthResponse } from '@auth/shared';
import type { SignedToken } from '../../tokens/interfaces/signed-token.interface';

/** What AuthService returns: the JSON body plus the refresh token the controller puts in a cookie. */
export interface AuthResult {
  body: AuthResponse;
  refresh: SignedToken;
  sessionId: string;
}
