/**
 * Errors raised by Express middleware (body-parser, etc.) via the `http-errors` convention:
 * a numeric `status` and `expose: true` when the message is safe to show to the client.
 */
export interface ExposedHttpError {
  status: number;
  type?: string;
}

/** True for client errors (4xx) that middleware marked as safe to expose. */
export function isExposedClientHttpError(error: unknown): error is ExposedHttpError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500 &&
    'expose' in error &&
    error.expose === true
  );
}
