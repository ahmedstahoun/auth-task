import { Body, Controller, Global, HttpCode, Module, Post } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { apiErrorSchema } from '@auth/shared';
import request from 'supertest';
import { mockConfig } from '../test/utils/mocks';
import { configureApp } from './bootstrap';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingModule } from './common/logging/logging.module';
import { MALFORMED_JSON } from './common/middleware/body-parser-errors.middleware';
import { AppConfig } from './config/app-config';

@Controller('echo')
class EchoController {
  @Post()
  @HttpCode(200)
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

@Global()
@Module({ providers: [{ provide: AppConfig, useValue: mockConfig() }], exports: [AppConfig] })
class ConfigStubModule {}

/** The production HTTP pipeline (configureApp) without a database: body limits, headers, errors. */
describe('HTTP pipeline (configureApp)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigStubModule, LoggingModule],
      controllers: [EchoController],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a normal JSON body', async () => {
    await request(app.getHttpServer()).post('/echo').send({ a: 1 }).expect(200, { a: 1 });
  });

  it('answers malformed JSON with 400 and a fixed message (no parser text)', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"password":"hunter2",}')
      .expect(400);
    const body = apiErrorSchema.parse(res.body);
    expect(body.message).toBe(MALFORMED_JSON);
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('answers bodies over 10kb with 413 in the standard error shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .send({ blob: 'x'.repeat(11_000) })
      .expect(413);
    expect(apiErrorSchema.parse(res.body)).toMatchObject({
      statusCode: 413,
      message: 'Payload Too Large',
    });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).post('/echo').send({});
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
