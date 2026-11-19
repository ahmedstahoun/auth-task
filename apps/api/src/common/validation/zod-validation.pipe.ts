import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export type ValidationDetails = Record<string, string[]>;

export class ZodValidationException extends BadRequestException {
  constructor(readonly details: ValidationDetails) {
    super('Validation failed');
  }
}

export function toValidationDetails(error: z.ZodError): ValidationDetails {
  const details: ValidationDetails = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Validates and transforms a request part with a zod schema from @auth/shared — the same schema
 * the web forms use, so client and server rules cannot drift.
 */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ZodValidationException(toValidationDetails(result.error));
    }
    return result.data;
  }
}
