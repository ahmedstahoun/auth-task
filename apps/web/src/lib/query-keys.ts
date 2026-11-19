/** Typed query-key factory: one place to change, no stringly-typed keys scattered around. */
export const queryKeys = {
  me: ['users', 'me'] as const,
  sessions: ['auth', 'sessions'] as const,
};
