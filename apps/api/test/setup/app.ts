import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { applyMongooseHardening } from '../../src/common/mongo/mongo.config';
import { AppConfig } from '../../src/config/app-config';
import { validateEnv, type Env } from '../../src/config/env.schema';

export const ORIGIN = 'http://localhost:5173';

export interface TestApp {
  app: NestExpressApplication;
  http: () => TestAgent;
  connection: Connection;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule with the exact production HTTP pipeline (configureApp).
 * `env` overrides go through the same validation as production config.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const config = new AppConfig(
    new ConfigService<Env, true>(validateEnv({ ...process.env, ...env })),
  );

  applyMongooseHardening();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useValue(config)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    bodyParser: false,
  });
  configureApp(app);
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());
  // autoIndex builds indexes in the background; wait so unique/TTL indexes exist before tests.
  await Promise.all(Object.values(connection.models).map((model) => model.init()));

  return {
    app,
    connection,
    http: () => request(app.getHttpServer()),
    reset: async () => {
      await Promise.all(Object.values(connection.collections).map((c) => c.deleteMany({})));
    },
    close: async () => {
      await connection.dropDatabase();
      await app.close();
    },
  };
}

export interface Cookie {
  name: string;
  value: string;
  attributes: string[];
}

export function parseSetCookie(header: unknown): Cookie[] {
  const lines = Array.isArray(header)
    ? header.filter((h): h is string => typeof h === 'string')
    : [];
  return lines.map((line) => {
    const [pair = '', ...attributes] = line.split(';').map((p) => p.trim());
    const eq = pair.indexOf('=');
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attributes };
  });
}

export function refreshCookieFrom(header: unknown): string {
  const cookie = parseSetCookie(header).find((c) => c.name === 'refresh_token');
  if (!cookie?.value) throw new Error('refresh cookie not set');
  return `refresh_token=${cookie.value}`;
}

export const validUser = { email: 'jane@example.com', name: 'Jane Doe', password: 'Str0ng!pass' };
