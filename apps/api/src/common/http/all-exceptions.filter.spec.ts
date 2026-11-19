import { createMock } from '@golevelup/ts-jest';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { apiErrorSchema } from '@auth/shared';
import { mockConfig, mockPinoLogger } from '../../../test/utils/mocks';
import { ZodValidationException } from '../validation/zod-validation.pipe';
import { AllExceptionsFilter, normalizeException } from './all-exceptions.filter';

function run(exception: unknown, production = false) {
  const logger = mockPinoLogger();
  const filter = new AllExceptionsFilter(
    logger,
    mockConfig({ NODE_ENV: production ? 'production' : 'test' }),
  );
  const json = jest.fn<undefined, [unknown]>();
  const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({ json });
  const http = createMock<HttpArgumentsHost>();
  http.getRequest.mockReturnValue({ url: '/auth/signin', id: 'req-1' });
  http.getResponse.mockReturnValue({ status });
  const host = createMock<ArgumentsHost>();
  host.switchToHttp.mockReturnValue(http);
  filter.catch(exception, host);
  const body = json.mock.calls[0]?.[0];
  return { status, body: apiErrorSchema.parse(body), logger };
}

describe('AllExceptionsFilter', () => {
  it('returns the shared ApiError shape with the request id', () => {
    const { status, body } = run(new UnauthorizedException('Invalid credentials'));
    expect(status).toHaveBeenCalledWith(401);
    expect(body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid credentials',
      path: '/auth/signin',
      requestId: 'req-1',
    });
  });

  it('includes field details for validation errors', () => {
    const { body } = run(new ZodValidationException({ email: ['Enter a valid email address'] }));
    expect(body).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      details: { email: ['Enter a valid email address'] },
    });
  });

  it('maps a Mongo duplicate key error to 409', () => {
    expect(run(Object.assign(new Error('E11000'), { code: 11000 })).body.statusCode).toBe(409);
  });

  it('hides internals of unknown errors and logs them at error level', () => {
    const { body, logger } = run(new Error('connection string mongodb://user:pass@host'));
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('mongodb://');
    expect(logger.error).toHaveBeenCalled();
  });

  it('hides 5xx HttpException messages in production only', () => {
    const exception = new HttpException('db pool exhausted', 503);
    expect(run(exception, true).body.message).toBe('Internal server error');
    expect(run(exception, false).body.message).toBe('db pool exhausted');
  });

  it('logs 4xx at warn without a stack', () => {
    const { logger } = run(new NotFoundException());
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).not.toHaveProperty('err');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps 429 from the throttler', () => {
    expect(run(new ThrottlerException()).body.statusCode).toBe(429);
  });
});

describe('normalizeException', () => {
  it('joins array messages from HttpException payloads', () => {
    expect(normalizeException(new BadRequestException({ message: ['a', 'b'] })).message).toBe(
      'a; b',
    );
  });

  it('falls back to the exception message for unusual payloads', () => {
    expect(normalizeException(new HttpException({ foo: 1 }, 418)).message).toBe('Http Exception');
  });
});
