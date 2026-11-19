import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { errorMessage, toApiError } from '@/lib/api/errors';

/**
 * Maps an API failure onto the form: field-level validation details go to their fields, a
 * conflict on email goes to the email field, everything else becomes a form-level message.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  const apiError = toApiError(error);

  if (apiError?.statusCode === 400 && apiError.details) {
    let mapped = false;
    for (const field of fields) {
      const message = apiError.details[field]?.[0];
      if (message) {
        setError(field, { type: 'server', message });
        mapped = true;
      }
    }
    if (mapped) return;
  }

  const emailField = fields.find((f) => f === 'email');
  if (apiError?.statusCode === 409 && emailField) {
    setError(emailField, { type: 'server', message: apiError.message });
    return;
  }

  setError('root.server', {
    type: String(apiError?.statusCode ?? 'network'),
    message: errorMessage(error),
  });
}
