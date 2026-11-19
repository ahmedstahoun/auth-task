import type { ValidationDetails } from './validation-details.interface';

/** Any thrown value reduced to what the API error contract needs. */
export interface NormalizedError {
  statusCode: number;
  message: string;
  details?: ValidationDetails;
}
