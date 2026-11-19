import { Schema, type InferSchemaType } from 'mongoose';

export const SESSION_MODEL = 'Session';
export const LOGIN_ATTEMPT_MODEL = 'LoginAttempt';

export const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    /** SHA-256 of the refresh token jti — the raw value is never stored. */
    refreshJtiHash: { type: String, required: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    lastUsedAt: { type: Date, required: true },
    /** TTL index: MongoDB deletes expired sessions (checked ~every 60s, so reads also filter). */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  {
    collection: 'sessions',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

export const loginAttemptSchema = new Schema(
  {
    /** Normalised email. */
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { collection: 'login_attempts', versionKey: false },
);

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export type LoginAttemptDocument = InferSchemaType<typeof loginAttemptSchema>;
