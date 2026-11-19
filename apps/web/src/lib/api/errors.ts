import { isApiError, type ApiError } from '@auth/shared';
import { isAxiosError } from 'axios';

/** Narrows anything thrown by the API client to the API's error contract, if it is one. */
export function toApiError(error: unknown): ApiError | null {
  if (!isAxiosError(error)) return null;
  const data: unknown = error.response?.data;
  return isApiError(data) ? data : null;
}

export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError) return apiError.message;
  if (isAxiosError(error) && !error.response)
    return 'Cannot reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}
