import { trusted } from 'mongoose';

/** `expiresAt > now` — our own operator, explicitly trusted past `sanitizeFilter`. */
export const notExpired = (): { $gt: Date } => trusted({ $gt: new Date() });
