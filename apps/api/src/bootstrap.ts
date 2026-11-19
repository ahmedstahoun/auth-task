import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from './common/logging/logger.config';
import { bodyParserErrorHandler } from './common/middleware/body-parser-errors.middleware';
import { AppConfig } from './config/app-config';

/**
 * Applies HTTP-level configuration. Shared by main.ts and the e2e tests so tests exercise
 * exactly the production pipeline.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.flushLogs();

  app.disable('x-powered-by');
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.use(helmet());
  app.use(cookieParser());
  // JSON only, small bodies: the API never needs more than a few hundred bytes per request.
  app.useBodyParser('json', { limit: '10kb' });
  app.use(bodyParserErrorHandler);
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  });
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Auth API')
        .setDescription('Sign up / sign in with rotating refresh tokens')
        .setVersion('1.0.0')
        .addBearerAuth()
        .addCookieAuth('refresh_token')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
