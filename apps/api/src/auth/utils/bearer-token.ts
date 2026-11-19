/** Returns the token from `Authorization: Bearer <token>`, or null for anything else. */
export function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  return token;
}
