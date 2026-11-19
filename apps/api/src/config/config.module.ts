import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config';
import { validateEnv } from './env.schema';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ cache: true, validate: validateEnv })],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
