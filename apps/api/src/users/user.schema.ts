import { Schema, type InferSchemaType, type Types } from 'mongoose';
import { NAME_MAX_LENGTH } from '@auth/shared';

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
    /** Never selected by default — only the sign-in path opts in with `+passwordHash`. */
    passwordHash: { type: String, required: true, select: false },
  },
  { collection: 'users', timestamps: true, versionKey: false, strict: 'throw' },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserRecord = User & { _id: Types.ObjectId };
