import { NAME_MAX_LENGTH } from '@auth/shared';
import { Schema, type InferSchemaType } from 'mongoose';

export const USER_MODEL = 'User';

export const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    /** Never selected by default — only the credentials lookup opts in with `+passwordHash`. */
    passwordHash: { type: String, required: true, select: false },
  },
  { collection: 'users', timestamps: true, versionKey: false, strict: 'throw' },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
