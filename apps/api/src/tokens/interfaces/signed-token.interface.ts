export interface SignedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}
