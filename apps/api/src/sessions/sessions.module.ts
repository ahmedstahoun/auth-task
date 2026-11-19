import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoSessionStore } from './mongo-session.store';
import {
  LOGIN_ATTEMPT_MODEL,
  loginAttemptSchema,
  SESSION_MODEL,
  sessionSchema,
} from './session.schemas';
import { SessionStore } from './session-store';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SESSION_MODEL, schema: sessionSchema },
      { name: LOGIN_ATTEMPT_MODEL, schema: loginAttemptSchema },
    ]),
  ],
  providers: [{ provide: SessionStore, useClass: MongoSessionStore }],
  exports: [SessionStore],
})
export class SessionsModule {}
