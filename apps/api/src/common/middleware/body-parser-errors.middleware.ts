import { STATUS_CODES } from 'node:http';
import { HttpException } from '@nestjs/common';
import type { ErrorRequestHandler } from 'express';
import { isExposedClientHttpError } from '../utils/http-errors';

export const MALFORMED_JSON = 'Malformed JSON body';

/**
 * Registered right after the JSON body parser. Turns its errors (400 malformed JSON, 413 too large,
 * 415 …) into HttpExceptions with fixed messages, so the global exception filter answers them in the
 * standard error shape. The parser's own message is never forwarded: it can quote the raw body.
 * (Left alone, Nest wraps parse errors as `BadRequestException(parserMessage)`, and maps 413 to 500.)
 */
export const bodyParserErrorHandler: ErrorRequestHandler = (error: unknown, _req, _res, next) => {
  if (!isExposedClientHttpError(error)) {
    next(error);
    return;
  }
  const message =
    error.type === 'entity.parse.failed'
      ? MALFORMED_JSON
      : (STATUS_CODES[error.status] ?? 'Bad Request');
  next(new HttpException(message, error.status));
};
