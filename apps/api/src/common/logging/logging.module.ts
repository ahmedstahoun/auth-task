import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { AuditLogger } from './audit-logger.service';
import { buildLoggerParams } from './logger.config';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        buildLoggerParams({ NODE_ENV: config.get('NODE_ENV'), LOG_LEVEL: config.get('LOG_LEVEL') }),
    }),
  ],
  providers: [AuditLogger],
  exports: [AuditLogger],
})
export class LoggingModule {}
