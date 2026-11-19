import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { applyMongooseHardening } from './common/mongo/mongo.config';
import { AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  applyMongooseHardening();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false, // re-registered in configureApp with a strict JSON-only limit
  });
  configureApp(app);
  await app.listen(app.get(AppConfig).get('PORT'));
}

void bootstrap();
