import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Not buffered: if MongoDB is unreachable, the connection retries must be visible at boot.
    bufferLogs: false,
    bodyParser: false, // re-registered in configureApp with a strict JSON-only limit
  });
  configureApp(app);
  await app.listen(app.get(AppConfig).get('PORT'));
}

void bootstrap();
