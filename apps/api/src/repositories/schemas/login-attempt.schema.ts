import { Schema, type InferSchemaType } from 'mongoose';

export const LOGIN_ATTEMPT_MODEL = 'LoginAttempt';

export const loginAttemptSchema = new Schema(
  {
    /** Normalised email. */
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { collection: 'login_attempts', versionKey: false },
);

export type LoginAttemptDocument = InferSchemaType<typeof loginAttemptSchema>;
