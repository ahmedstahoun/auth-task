import mongoose from 'mongoose';

/**
 * Global Mongoose hardening, applied once before any connection is opened:
 * - strictQuery: unknown fields in filters are dropped instead of passed through
 * - sanitizeFilter: user-supplied objects with `$`-operators are neutralised (NoSQL injection);
 *   our own operator queries opt in explicitly with `mongoose.trusted()`.
 */
export function applyMongooseHardening(): void {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true);
}
