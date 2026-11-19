import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LOGIN_ATTEMPTS_REPOSITORY } from './interfaces/login-attempts-repository.interface';
import { SESSIONS_REPOSITORY } from './interfaces/sessions-repository.interface';
import { USERS_REPOSITORY } from './interfaces/users-repository.interface';
import { MongoLoginAttemptsRepository } from './mongo/mongo-login-attempts.repository';
import { MongoSessionsRepository } from './mongo/mongo-sessions.repository';
import { MongoUsersRepository } from './mongo/mongo-users.repository';
import { LOGIN_ATTEMPT_MODEL, loginAttemptSchema } from './schemas/login-attempt.schema';
import { SESSION_MODEL, sessionSchema } from './schemas/session.schema';
import { USER_MODEL, userSchema } from './schemas/user.schema';

/**
 * The persistence boundary. Registers the Mongoose models and exposes them only through
 * repository interfaces (bound to injection tokens), so services never depend on Mongoose.
 * Swapping a store (e.g. sessions → Redis) means changing one `useClass` here.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: USER_MODEL, schema: userSchema },
      { name: SESSION_MODEL, schema: sessionSchema },
      { name: LOGIN_ATTEMPT_MODEL, schema: loginAttemptSchema },
    ]),
  ],
  providers: [
    { provide: USERS_REPOSITORY, useClass: MongoUsersRepository },
    { provide: SESSIONS_REPOSITORY, useClass: MongoSessionsRepository },
    { provide: LOGIN_ATTEMPTS_REPOSITORY, useClass: MongoLoginAttemptsRepository },
  ],
  exports: [USERS_REPOSITORY, SESSIONS_REPOSITORY, LOGIN_ATTEMPTS_REPOSITORY],
})
export class RepositoriesModule {}
