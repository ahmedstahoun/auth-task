import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { bodyParserErrorHandler, MALFORMED_JSON } from './body-parser-errors.middleware';

function run(error: unknown): unknown {
  const next = jest.fn<undefined, [unknown]>();
  bodyParserErrorHandler(error, {} as Request, {} as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0];
}

const parserError = (status: number, type: string, message: string): Error =>
  Object.assign(new Error(message), { status, expose: true, type });

describe('bodyParserErrorHandler', () => {
  it('maps malformed JSON to 400 without echoing the parser message', () => {
    const forwarded = run(
      parserError(400, 'entity.parse.failed', 'Unexpected token } in JSON: {"pw":"x",}'),
    );
    expect(forwarded).toBeInstanceOf(HttpException);
    expect(forwarded).toMatchObject({ message: MALFORMED_JSON });
    expect((forwarded as HttpException).getStatus()).toBe(400);
  });

  it('maps an oversized body to 413', () => {
    const forwarded = run(parserError(413, 'entity.too.large', 'request entity too large'));
    expect((forwarded as HttpException).getStatus()).toBe(413);
    expect(forwarded).toMatchObject({ message: 'Payload Too Large' });
  });

  it.each([
    ['an ordinary error', new Error('boom')],
    ['a non-exposed 4xx', Object.assign(new Error('x'), { status: 400, expose: false })],
    ['an exposed 5xx', Object.assign(new Error('x'), { status: 503, expose: true })],
  ])('passes %s through untouched', (_label, error) => {
    expect(run(error)).toBe(error);
  });
});
