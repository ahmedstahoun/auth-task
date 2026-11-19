import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthResponse, SessionDto, SignInInput, SignUpInput, UserDto } from '@auth/shared';
import type { ClientContext } from '../common/http/request-context';
import { AuditLogger } from '../common/logging/audit-logger.service';
import { AppConfig } from '../config/app-config';
import { SessionStore } from '../sessions/session-store';
import { TokenService, type SignedToken } from '../tokens/token.service';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './auth-user';
import { PasswordService } from './password.service';

export interface AuthResult {
  body: AuthResponse;
  refresh: SignedToken;
  sessionId: string;
}

export const INVALID_CREDENTIALS = 'Invalid credentials';
export const TOO_MANY_ATTEMPTS = 'Too many failed sign-in attempts. Please try again later.';
const SESSION_INVALID = 'Session is no longer valid';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionStore,
    private readonly audit: AuditLogger,
    private readonly config: AppConfig,
  ) {}

  async signUp(input: SignUpInput, client: ClientContext): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.create({ email: input.email, name: input.name, passwordHash });
    this.audit.record({ event: 'signup', userId: user.id }, client);
    return this.startSession(user, client);
  }

  async signIn(input: SignInInput, client: ClientContext): Promise<AuthResult> {
    const maxAttempts = this.config.get('LOCKOUT_MAX_ATTEMPTS');
    if ((await this.sessions.countFailedLogins(input.email)) >= maxAttempts) {
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const credentials = await this.users.findCredentialsByEmail(input.email);
    const valid = credentials
      ? await this.passwords.verify(credentials.passwordHash, input.password)
      : await this.passwords.verifyDummy(input.password);

    if (!credentials || !valid) {
      await this.onFailedSignIn(
        input.email,
        credentials ? 'wrong_password' : 'unknown_email',
        client,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const user = await this.users.findById(credentials.id);
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);

    await this.sessions.clearFailedLogins(input.email);
    const result = await this.startSession(user, client);
    this.audit.record(
      { event: 'signin_success', userId: user.id, sessionId: result.sessionId },
      client,
    );
    return result;
  }

  async refresh(refreshToken: string | null, client: ClientContext): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const claims = await this.tokens.verifyRefresh(refreshToken);
    if (!claims) throw new UnauthorizedException('Invalid or expired refresh token');

    const next = await this.tokens.signRefresh(claims.sub, claims.sid, new Date(claims.exp * 1000));
    const rotation = await this.sessions.rotate(claims.sid, claims.jti, next.jti);

    switch (rotation.status) {
      case 'rotated': {
        const user = await this.users.findById(rotation.session.userId);
        if (!user) {
          await this.sessions.revoke(claims.sid);
          throw new UnauthorizedException(SESSION_INVALID);
        }
        return {
          body: await this.buildResponse(user, claims.sid),
          refresh: next,
          sessionId: claims.sid,
        };
      }
      case 'reuse_detected': {
        // An already-rotated token came back: assume it was stolen and kill every session.
        const revokedSessions = await this.sessions.revokeAllForUser(rotation.userId);
        this.audit.record(
          {
            event: 'refresh_reuse_detected',
            userId: rotation.userId,
            sessionId: claims.sid,
            revokedSessions,
          },
          client,
        );
        throw new UnauthorizedException(SESSION_INVALID);
      }
      case 'not_found':
        throw new UnauthorizedException(SESSION_INVALID);
    }
  }

  /** Idempotent: always succeeds so the client can clear its state. */
  async logout(refreshToken: string | null, client: ClientContext): Promise<void> {
    if (!refreshToken) return;
    const claims = await this.tokens.verifyRefresh(refreshToken);
    if (!claims) return;
    await this.sessions.revoke(claims.sid);
    this.audit.record({ event: 'logout', userId: claims.sub, sessionId: claims.sid }, client);
  }

  async logoutAll(user: AuthUser, client: ClientContext): Promise<void> {
    const revokedSessions = await this.sessions.revokeAllForUser(user.id);
    this.audit.record({ event: 'logout_all', userId: user.id, revokedSessions }, client);
  }

  async listSessions(user: AuthUser): Promise<SessionDto[]> {
    const sessions = await this.sessions.listActiveForUser(user.id);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === user.sessionId,
    }));
  }

  private async onFailedSignIn(
    email: string,
    reason: 'unknown_email' | 'wrong_password',
    client: ClientContext,
  ): Promise<void> {
    const failures = await this.sessions.registerFailedLogin(
      email,
      this.config.get('LOCKOUT_WINDOW_SECONDS'),
    );
    this.audit.record({ event: 'signin_failed', email, reason }, client);
    if (failures === this.config.get('LOCKOUT_MAX_ATTEMPTS')) {
      this.audit.record({ event: 'lockout', email }, client);
    }
  }

  private async startSession(user: UserDto, client: ClientContext): Promise<AuthResult> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.get('JWT_REFRESH_TTL_SECONDS') * 1000);
    const refresh = await this.tokens.signRefresh(user.id, sessionId, expiresAt);
    await this.sessions.create({
      id: sessionId,
      userId: user.id,
      refreshJti: refresh.jti,
      userAgent: client.userAgent,
      ip: client.ip,
      expiresAt,
    });
    return { body: await this.buildResponse(user, sessionId), refresh, sessionId };
  }

  private async buildResponse(user: UserDto, sessionId: string): Promise<AuthResponse> {
    const access = await this.tokens.signAccess(user.id, sessionId);
    return { accessToken: access.token, expiresIn: this.tokens.accessTtlSeconds, user };
  }
}
