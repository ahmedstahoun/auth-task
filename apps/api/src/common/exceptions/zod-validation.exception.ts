import { BadRequestException } from '@nestjs/common';
import type { ValidationDetails } from '../interfaces/validation-details.interface';

export class ZodValidationException extends BadRequestException {
  constructor(readonly details: ValidationDetails) {
    super('Validation failed');
  }
}
