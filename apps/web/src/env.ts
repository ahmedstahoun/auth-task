import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url().default('http://localhost:3000'),
});

/** Validated once at startup — a misconfigured build fails loudly instead of calling `undefined`. */
export const env = envSchema.parse(import.meta.env);
