import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { buildThrottlerOptions } from './auth/rate-limit';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.get('MONGO_URI'),
        serverSelectionTimeoutMS: 5000,
        // Builds the unique + TTL indexes on boot. In a larger system these would be migrations.
        autoIndex: true,
      }),
    }),
    ThrottlerModule.forRootAsync({ inject: [AppConfig], useFactory: buildThrottlerOptions }),
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
