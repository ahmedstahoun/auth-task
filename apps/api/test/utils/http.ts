import { createMock } from '@golevelup/ts-jest';
import type { ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import type { Request } from 'express';

/** Minimal ExecutionContext around a fake Express request for guard / decorator tests. */
export function httpContext(
  request: Partial<Request>,
  handler: () => void = () => undefined,
): ExecutionContext {
  const http = createMock<HttpArgumentsHost>();
  http.getRequest.mockReturnValue(request);
  const context = createMock<ExecutionContext>();
  context.switchToHttp.mockReturnValue(http);
  context.getHandler.mockReturnValue(handler);
  return context;
}

/** Fake Express request with a header lookup compatible with `req.get()`. */
export function fakeRequest(
  headers: Record<string, string> = {},
  extra: Partial<Request> = {},
): Partial<Request> {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const get = (name: string): string | undefined => lower[name.toLowerCase()];
  return { headers: lower, get: get as Request['get'], ...extra };
}
