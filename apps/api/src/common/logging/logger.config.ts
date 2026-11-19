import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env, LogLevel } from '../../config/env.schema';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REQUEST_ID_HEADER = 'x-request-id';

const SENSITIVE_KEYS = ['password', 'passwordHash', 'accessToken', 'refreshToken', 'token'];

/**
 * Paths censored in every log line, including objects passed to logger calls.
 * pino's `*.key` only matches one level down, so top-level keys are listed explicitly too.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
];

export function resolveLogLevel(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): LogLevel {
  if (env.LOG_LEVEL) return env.LOG_LEVEL;
  switch (env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'silent';
    case 'development':
      return 'debug';
  }
}

/** Reuse a well-formed incoming request id (for tracing across services), otherwise mint one. */
export function resolveRequestId(header: string | string[] | undefined): string {
  return typeof header === 'string' && UUID_PATTERN.test(header) ? header : randomUUID();
}

interface SerializedReq {
  id: unknown;
  method: unknown;
  url: unknown;
  remoteAddress: unknown;
  headers: Record<string, unknown>;
}

interface SerializedRes {
  statusCode: unknown;
}

export function buildLoggerParams(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Params {
  return {
    // Adds context assigned during the request (e.g. userId) to the "request completed" line.
    assignResponse: true,
    pinoHttp: {
      level: resolveLogLevel(env),
      ...(env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
      genReqId: (req: IncomingMessage, res: ServerResponse): string => {
        const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },
      serializers: {
        req: (req: SerializedReq) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          userAgent: req.headers['user-agent'],
        }),
        res: (res: SerializedRes) => ({ statusCode: res.statusCode }),
      },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      customLogLevel: (_req, res, err) => {
        if (err !== undefined || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: {
        ignore: (req) => req.url?.startsWith('/health') ?? false,
      },
    },
  };
}
