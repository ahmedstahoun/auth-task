import { Global, Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import mongoose from 'mongoose';
import { mockConfig } from '../test/utils/mocks';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { buildThrottlerOptions } from './auth/config/throttler.config';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfig } from './config/app-config';
import { LOGIN_ATTEMPTS_REPOSITORY } from './repositories/interfaces/login-attempts-repository.interface';
import { SESSIONS_REPOSITORY } from './repositories/interfaces/sessions-repository.interface';
import { USERS_REPOSITORY } from './repositories/interfaces/users-repository.interface';
import { MongoLoginAttemptsRepository } from './repositories/mongo/mongo-login-attempts.repository';
import { MongoSessionsRepository } from './repositories/mongo/mongo-sessions.repository';
import { MongoUsersRepository } from './repositories/mongo/mongo-users.repository';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';

/**
 * Catches DI mistakes (missing @Inject token, unexported provider, wrong module import) that the
 * type checker cannot see, without needing a database: the real feature modules are compiled
 * against a never-connected Mongoose connection.
 */
const connection = mongoose.createConnection();

@Global()
@Module({
  providers: [
    { provide: AppConfig, useValue: mockConfig() },
    { provide: getConnectionToken(), useValue: connection },
  ],
  exports: [AppConfig, getConnectionToken()],
})
class TestInfrastructureModule {}

describe('application wiring', () => {
  afterAll(async () => {
    await connection.close();
  });

  it('resolves every provider, controller and guard of the feature modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TestInfrastructureModule,
        LoggingModule,
        ThrottlerModule.forRootAsync({ inject: [AppConfig], useFactory: buildThrottlerOptions }),
        UsersModule,
        AuthModule,
      ],
    }).compile();

    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
    expect(moduleRef.get(AuthController)).toBeInstanceOf(AuthController);
    expect(moduleRef.get(UsersController)).toBeInstanceOf(UsersController);
    expect(moduleRef.get(USERS_REPOSITORY, { strict: false })).toBeInstanceOf(MongoUsersRepository);
    expect(moduleRef.get(SESSIONS_REPOSITORY, { strict: false })).toBeInstanceOf(
      MongoSessionsRepository,
    );
    expect(moduleRef.get(LOGIN_ATTEMPTS_REPOSITORY, { strict: false })).toBeInstanceOf(
      MongoLoginAttemptsRepository,
    );
    // Guards are instantiated per module: resolve it where it is used.
    await expect(moduleRef.select(UsersModule).resolve(JwtAuthGuard)).resolves.toBeInstanceOf(
      JwtAuthGuard,
    );
    await moduleRef.close();
  });
});
