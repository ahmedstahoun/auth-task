import { z } from 'zod';

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});

export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
  user: userDtoSchema,
});

export const sessionDtoSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  /** Field-level validation issues, keyed by dotted path. */
  details: z.record(z.string(), z.array(z.string())).optional(),
  path: z.string(),
  timestamp: z.iso.datetime(),
  requestId: z.string(),
});

export type UserDto = z.infer<typeof userDtoSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export function isApiError(value: unknown): value is ApiError {
  return apiErrorSchema.safeParse(value).success;
}
