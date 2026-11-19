import type { DeepMocked } from '@golevelup/ts-jest';
import { createMock } from '@golevelup/ts-jest';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  buildClient,
  buildSession,
  buildSignInInput,
  buildSignUpInput,
  buildUserDto,
} from '../../test/utils/factories';
import { mockLoginAttemptsRepository, mockSessionsRepository } from '../../test/utils/mocks';
import { createTestingModule } from '../../test/utils/testing-module';
import { AuditLogger } from '../common/logging/audit-logger.service';
import {
  LOGIN_ATTEMPTS_REPOSITORY,
  type LoginAttemptsRepository,
} from '../repositories/interfaces/login-attempts-repository.interface';
import {
  SESSIONS_REPOSITORY,
  type SessionsRepository,
} from '../repositories/interfaces/sessions-repository.interface';
import type { SignedToken } from '../tokens/interfaces/signed-token.interface';
import type { RefreshClaims } from '../tokens/interfaces/token-claims.interface';
import { TokenService } from '../tokens/token.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS } from './constants/auth.constants';
import { PasswordService } from './services/password.service';

const signed = (token: string, jti = `${token}-jti`): SignedToken => ({
  token,
  jti,
  expiresAt: new Date(Date.now() + 60_000),
});

describe('AuthService', () => {
  let service: AuthService;
  let users: DeepMocked<UsersService>;
  let passwords: DeepMocked<PasswordService>;
  let tokens: DeepMocked<TokenService>;
  let sessions: DeepMocked<SessionsRepository>;
  let loginAttempts: DeepMocked<LoginAttemptsRepository>;
  let audit: DeepMocked<AuditLogger>;
  const client = buildClient();
  const user = buildUserDto();

  beforeEach(async () => {
    users = createMock<UsersService>();
    passwords = createMock<PasswordService>();
    tokens = createMock<TokenService>({ accessTtlSeconds: 900 });
    sessions = mockSessionsRepository();
    loginAttempts = mockLoginAttemptsRepository();

    tokens.signAccess.mockResolvedValue(signed('access'));
    tokens.signRefresh.mockResolvedValue(signed('refresh'));
    sessions.create.mockResolvedValue(buildSession({ userId: user.id }));
    loginAttempts.countFailures.mockResolvedValue(0);

    const moduleRef = await createTestingModule({
      providers: [AuthService],
      overrides: [
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: SESSIONS_REPOSITORY, useValue: sessions },
        { provide: LOGIN_ATTEMPTS_REPOSITORY, useValue: loginAttempts },
      ],
      env: { LOCKOUT_MAX_ATTEMPTS: 3 },
    });
    service = moduleRef.get(AuthService);
    audit = moduleRef.get(AuditLogger);
  });

  describe('signUp', () => {
    it('hashes the password, creates the user and starts a session', async () => {
      passwords.hash.mockResolvedValue('hashed');
      users.create.mockResolvedValue(user);

      const result = await service.signUp(buildSignUpInput(), client);

      expect(users.create).toHaveBeenCalledWith({
        email: 'jane@example.com',
        name: 'Jane Doe',
        passwordHash: 'hashed',
      });
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          refreshJti: 'refresh-jti',
          ip: client.ip,
          userAgent: client.userAgent,
        }),
      );
      expect(result.body).toEqual({ accessToken: 'access', expiresIn: 900, user });
      expect(result.refresh.token).toBe('refresh');
      expect(audit.record).toHaveBeenCalledWith({ event: 'signup', userId: user.id }, client);
    });

    it('never stores the plain password', async () => {
      passwords.hash.mockResolvedValue('hashed');
      users.create.mockResolvedValue(user);
      await service.signUp(buildSignUpInput({ password: 'Plain!text1' }), client);
      expect(JSON.stringify(users.create.mock.calls)).not.toContain('Plain!text1');
    });

    it('propagates a duplicate email as 409', async () => {
      users.create.mockRejectedValue(
        new ConflictException('An account with this email already exists'),
      );
      await expect(service.signUp(buildSignUpInput(), client)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('returns tokens and clears failed attempts on valid credentials', async () => {
      users.findCredentialsByEmail.mockResolvedValue({ id: user.id, passwordHash: 'hash' });
      users.findById.mockResolvedValue(user);
      passwords.verify.mockResolvedValue(true);

      const result = await service.signIn(buildSignInInput(), client);

      expect(result.body.user).toEqual(user);
      expect(loginAttempts.clear).toHaveBeenCalledWith('jane@example.com');
      expect(audit.record).toHaveBeenCalledWith(
        { event: 'signin_success', userId: user.id, sessionId: result.sessionId },
        client,
      );
    });

    it('returns 401 with a generic message when the password is wrong', async () => {
      users.findCredentialsByEmail.mockResolvedValue({ id: user.id, passwordHash: 'hash' });
      passwords.verify.mockResolvedValue(false);
      loginAttempts.registerFailure.mockResolvedValue(1);

      await expect(service.signIn(buildSignInInput(), client)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(audit.record).toHaveBeenCalledWith(
        { event: 'signin_failed', email: 'jane@example.com', reason: 'wrong_password' },
        client,
      );
    });

    it('returns the identical 401 for an unknown email and still burns a hash verification', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);
      passwords.verifyDummy.mockResolvedValue(false);
      loginAttempts.registerFailure.mockResolvedValue(1);

      await expect(service.signIn(buildSignInInput(), client)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(passwords.verifyDummy).toHaveBeenCalledWith('Str0ng!pass');
      expect(passwords.verify).not.toHaveBeenCalled();
    });

    it('records a lockout exactly when the threshold is reached', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);
      loginAttempts.registerFailure.mockResolvedValue(3);

      await expect(service.signIn(buildSignInInput(), client)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(audit.record).toHaveBeenCalledWith(
        { event: 'lockout', email: 'jane@example.com' },
        client,
      );
    });

    it('rejects with 429 while locked out, without checking the password', async () => {
      loginAttempts.countFailures.mockResolvedValue(3);

      const error: unknown = await service
        .signIn(buildSignInInput(), client)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error).toMatchObject({ message: TOO_MANY_ATTEMPTS });
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(users.findCredentialsByEmail).not.toHaveBeenCalled();
    });

    it('fails closed if the user disappears between lookup and session start', async () => {
      users.findCredentialsByEmail.mockResolvedValue({ id: user.id, passwordHash: 'hash' });
      passwords.verify.mockResolvedValue(true);
      users.findById.mockResolvedValue(null);
      await expect(service.signIn(buildSignInInput(), client)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const claims: RefreshClaims = {
      sub: user.id,
      sid: '5f7a3b1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      jti: '6f7a3b1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      typ: 'refresh',
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('rejects a missing token', async () => {
      await expect(service.refresh(null, client)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid token', async () => {
      tokens.verifyRefresh.mockResolvedValue(null);
      await expect(service.refresh('bad', client)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotates the session and issues new tokens', async () => {
      tokens.verifyRefresh.mockResolvedValue(claims);
      tokens.signRefresh.mockResolvedValue(signed('refresh-2'));
      sessions.rotate.mockResolvedValue({
        status: 'rotated',
        session: buildSession({ id: claims.sid, userId: user.id }),
      });
      users.findById.mockResolvedValue(user);

      const result = await service.refresh('refresh-1', client);

      expect(sessions.rotate).toHaveBeenCalledWith(claims.sid, claims.jti, 'refresh-2-jti');
      // Keeps the session's absolute expiry instead of sliding it.
      expect(tokens.signRefresh).toHaveBeenCalledWith(
        user.id,
        claims.sid,
        new Date(claims.exp * 1000),
      );
      expect(result.refresh.token).toBe('refresh-2');
      expect(result.sessionId).toBe(claims.sid);
    });

    it('revokes ALL sessions of the user when a used refresh token is replayed', async () => {
      tokens.verifyRefresh.mockResolvedValue(claims);
      sessions.rotate.mockResolvedValue({ status: 'reuse_detected', userId: user.id });
      sessions.revokeAllForUser.mockResolvedValue(2);

      await expect(service.refresh('stolen', client)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith(user.id);
      expect(audit.record).toHaveBeenCalledWith(
        {
          event: 'refresh_reuse_detected',
          userId: user.id,
          sessionId: claims.sid,
          revokedSessions: 2,
        },
        client,
      );
    });

    it('rejects when the session no longer exists', async () => {
      tokens.verifyRefresh.mockResolvedValue(claims);
      sessions.rotate.mockResolvedValue({ status: 'not_found' });
      await expect(service.refresh('t', client)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('revokes the session if its user was deleted', async () => {
      tokens.verifyRefresh.mockResolvedValue(claims);
      sessions.rotate.mockResolvedValue({
        status: 'rotated',
        session: buildSession({ id: claims.sid }),
      });
      users.findById.mockResolvedValue(null);
      await expect(service.refresh('t', client)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.revoke).toHaveBeenCalledWith(claims.sid);
    });
  });

  describe('logout', () => {
    it('revokes the session identified by the refresh token', async () => {
      tokens.verifyRefresh.mockResolvedValue({
        sub: user.id,
        sid: 'sid',
        jti: 'jti',
        typ: 'refresh',
        iat: 1,
        exp: 2,
      });
      await service.logout('refresh', client);
      expect(sessions.revoke).toHaveBeenCalledWith('sid');
      expect(audit.record).toHaveBeenCalledWith(
        { event: 'logout', userId: user.id, sessionId: 'sid' },
        client,
      );
    });

    it.each([null, 'invalid'])('is a no-op for %p (idempotent)', async (token) => {
      tokens.verifyRefresh.mockResolvedValue(null);
      await expect(service.logout(token, client)).resolves.toBeUndefined();
      expect(sessions.revoke).not.toHaveBeenCalled();
    });
  });

  it('logoutAll revokes every session and audits the count', async () => {
    sessions.revokeAllForUser.mockResolvedValue(3);
    await service.logoutAll({ id: user.id, sessionId: 's' }, client);
    expect(audit.record).toHaveBeenCalledWith(
      { event: 'logout_all', userId: user.id, revokedSessions: 3 },
      client,
    );
  });

  it('listSessions maps records to DTOs and flags the current one', async () => {
    const current = buildSession({ userId: user.id });
    const other = buildSession({ userId: user.id });
    sessions.listActiveForUser.mockResolvedValue([current, other]);

    const result = await service.listSessions({ id: user.id, sessionId: current.id });

    expect(result.map((s) => s.current)).toEqual([true, false]);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: current.id, createdAt: current.createdAt.toISOString() }),
    );
  });
});
