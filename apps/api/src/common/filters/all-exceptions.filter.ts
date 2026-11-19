import { STATUS_CODES } from 'node:http';
import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError } from '@auth/shared';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { isDuplicateKeyError } from '../../database/mongo-errors';
import { isExposedClientHttpError } from '../utils/http-errors';
import { ZodValidationException } from '../exceptions/zod-validation.exception';
import type { NormalizedError } from '../interfaces/normalized-error.interface';

function messageFromHttpException(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && 'message' in response) {
    const { message } = response;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('; ');
  }
  return exception.message;
}

export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof ZodValidationException) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      details: exception.details,
    };
  }
  if (exception instanceof HttpException) {
    return { statusCode: exception.getStatus(), message: messageFromHttpException(exception) };
  }
  if (isDuplicateKeyError(exception)) {
    return { statusCode: HttpStatus.CONFLICT, message: 'Resource already exists' };
  }
  // body-parser & co. (413 too large, 400 malformed JSON, 415 …): keep their status, but use a
  // fixed message instead of the parser's text (which can echo fragments of the raw body).
  if (isExposedClientHttpError(exception)) {
    return {
      statusCode: exception.status,
      message:
        exception.type === 'entity.parse.failed'
          ? 'Malformed JSON body'
          : (STATUS_CODES[exception.status] ?? 'Bad Request'),
    };
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
}

/** One error shape for every failure. Internals are logged with the request id, never returned. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isProduction: boolean;

  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
    config: AppConfig,
  ) {
    this.isProduction = config.isProduction;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const normalized = normalizeException(exception);
    const isServerError = normalized.statusCode >= 500;
    const requestId = typeof request.id === 'string' ? request.id : 'unknown';

    if (isServerError) {
      this.logger.error({ err: exception, requestId }, 'Unhandled error');
    } else {
      this.logger.warn(
        { requestId, statusCode: normalized.statusCode, message: normalized.message },
        'Request failed',
      );
    }

    const body: ApiError = {
      statusCode: normalized.statusCode,
      error: STATUS_CODES[normalized.statusCode] ?? 'Error',
      message: isServerError && this.isProduction ? 'Internal server error' : normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.status(normalized.statusCode).json(body);
  }
}
