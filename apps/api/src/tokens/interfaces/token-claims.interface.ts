import type { z } from 'zod';
import type { accessClaimsSchema, refreshClaimsSchema } from '../schemas/token-claims.schema';

export type AccessClaims = z.infer<typeof accessClaimsSchema>;
export type RefreshClaims = z.infer<typeof refreshClaimsSchema>;
