import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildLoggerParams,
  REDACT_PATHS,
  resolveLogLevel,
  resolveRequestId,
} from './logger.config';

describe('logger config', () => {
  it.each([
    [{ NODE_ENV: 'production' as const }, 'info'],
    [{ NODE_ENV: 'development' as const }, 'debug'],
    [{ NODE_ENV: 'test' as const }, 'silent'],
    [{ NODE_ENV: 'production' as const, LOG_LEVEL: 'warn' as const }, 'warn'],
  ])('resolves the level for %j', (env, level) => {
    expect(resolveLogLevel(env)).toBe(level);
  });

  it('reuses a valid incoming request id and replaces anything else', () => {
    const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
    expect(resolveRequestId(id)).toBe(id);
    expect(resolveRequestId('<script>')).not.toBe('<script>');
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId([id, id])).not.toBe(id);
  });

  it('redacts credentials and tokens', () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.refreshToken',
      ]),
    );
  });

  describe('pino-http options', () => {
    const params = buildLoggerParams({ NODE_ENV: 'production' });
    const http = params.pinoHttp;
    if (!http || Array.isArray(http) || !('genReqId' in http))
      throw new Error('unexpected pinoHttp shape');

    it('uses JSON (no pretty transport) in production', () => {
      expect('transport' in http).toBe(false);
      expect('transport' in (buildLoggerParams({ NODE_ENV: 'development' }).pinoHttp ?? {})).toBe(
        true,
      );
    });

    it('echoes the request id in the response header', () => {
      const setHeader = jest.fn();
      const id = http.genReqId?.(
        { headers: {} } as IncomingMessage,
        { setHeader } as unknown as ServerResponse,
      );
      expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
    });

    it('logs 5xx as error, 4xx as warn, the rest as info', () => {
      const level = (statusCode: number, err?: Error) =>
        http.customLogLevel?.({} as IncomingMessage, { statusCode } as ServerResponse, err);
      expect(level(500)).toBe('error');
      expect(level(200, new Error('x'))).toBe('error');
      expect(level(404)).toBe('warn');
      expect(level(200)).toBe('info');
    });

    it('does not log health checks', () => {
      const autoLogging = http.autoLogging;
      if (typeof autoLogging !== 'object') throw new Error('expected autoLogging options');
      expect(autoLogging.ignore?.({ url: '/health' } as IncomingMessage)).toBe(true);
      expect(autoLogging.ignore?.({ url: '/auth/signin' } as IncomingMessage)).toBe(false);
    });

    it('serializes only safe request fields', () => {
      const serializers = http.serializers ?? {};
      const req: unknown = serializers['req']?.({
        id: 1,
        method: 'POST',
        url: '/x',
        remoteAddress: '::1',
        headers: { 'user-agent': 'ua', cookie: 'secret' },
      });
      expect(req).toEqual({
        id: 1,
        method: 'POST',
        url: '/x',
        remoteAddress: '::1',
        userAgent: 'ua',
      });
      const res: unknown = serializers['res']?.({
        statusCode: 200,
        headers: { 'set-cookie': 'x' },
      });
      expect(res).toEqual({ statusCode: 200 });
    });
  });
});
