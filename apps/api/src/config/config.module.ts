import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config';
import { validateEnv } from './env.schema';

@Global()
@Module({
  // Env comes from the process (node --env-file in dev, the platform in prod) — one mechanism only.
  imports: [ConfigModule.forRoot({ cache: true, ignoreEnvFile: true, validate: validateEnv })],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
