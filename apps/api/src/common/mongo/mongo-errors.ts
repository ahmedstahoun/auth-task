const DUPLICATE_KEY_ERROR_CODE = 11_000;

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_ERROR_CODE
  );
}
