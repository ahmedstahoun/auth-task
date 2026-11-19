/** The authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  sessionId: string;
}

declare global {
  // Express exposes its Request type for augmentation through this global namespace.
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
