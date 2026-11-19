import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const secret = (name: string): z.ZodString =>
  z
    .string({ error: `${name} is required` })
    .min(32, { error: `${name} must be at least 32 characters` });

const positiveInt = z.coerce.number().int().positive();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),

    MONGO_URI: z
      .string({ error: 'MONGO_URI is required' })
      .regex(/^mongodb(\+srv)?:\/\//, { error: 'MONGO_URI must be a mongodb:// URI' }),

    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL_SECONDS: positiveInt.default(900),
    JWT_REFRESH_TTL_SECONDS: positiveInt.default(604_800),
    JWT_ISSUER: z.string().min(1).default('auth-task-api'),
    JWT_AUDIENCE: z.string().min(1).default('auth-task-web'),

    CORS_ORIGINS: z
      .string({ error: 'CORS_ORIGINS is required' })
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .pipe(z.array(z.url({ error: 'CORS_ORIGINS must contain valid URLs' })).min(1)),
    TRUST_PROXY: z.stringbool().default(false),

    AUTH_RATE_LIMIT_PER_MINUTE: positiveInt.default(5),
    LOCKOUT_MAX_ATTEMPTS: positiveInt.default(5),
    LOCKOUT_WINDOW_SECONDS: positiveInt.default(900),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    error: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the raw environment once at boot. Fails fast with a readable list of problems;
 * secret values are never echoed back.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
