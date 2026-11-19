import { z } from 'zod';

const baseClaims = z.object({
  sub: z.string().min(1),
  sid: z.uuid(),
  jti: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
});

/** Verified JWT payloads are parsed with these, never trusted as typed. */
export const accessClaimsSchema = baseClaims.extend({ typ: z.literal('access') });
export const refreshClaimsSchema = baseClaims.extend({ typ: z.literal('refresh') });
