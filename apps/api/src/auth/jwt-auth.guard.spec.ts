import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { buildSession } from '../../test/utils/factories';
import { fakeRequest, httpContext } from '../../test/utils/http';
import { mockPinoLogger, mockSessionStore } from '../../test/utils/mocks';
import type { SessionStore } from '../sessions/session-store';
import type { AccessClaims, TokenService } from '../tokens/token.service';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    [undefined, null],
    ['abc', null],
    ['Basic abc', null],
    ['Bearer', null],
    ['Bearer a b', null],
  ])('%p → %p', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});

describe('JwtAuthGuard', () => {
  let tokens: DeepMocked<TokenService>;
  let sessions: DeepMocked<SessionStore>;
  let guard: JwtAuthGuard;
  const logger = mockPinoLogger();
  const session = buildSession();
  const claims: AccessClaims = {
    sub: session.userId,
    sid: session.id,
    jti: 'j',
    typ: 'access',
    iat: 1,
    exp: 2,
  };

  beforeEach(() => {
    tokens = createMock<TokenService>();
    sessions = mockSessionStore();
    guard = new JwtAuthGuard(tokens, sessions, logger);
  });

  const run = (request: Partial<Request>): Promise<boolean> =>
    guard.canActivate(httpContext(request));

  it('rejects a request without a bearer token', async () => {
    await expect(run(fakeRequest())).rejects.toThrow(
      new UnauthorizedException('Missing access token'),
    );
  });

  it('rejects an invalid or expired token', async () => {
    tokens.verifyAccess.mockResolvedValue(null);
    await expect(run(fakeRequest({ authorization: 'Bearer bad' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a valid token whose session was revoked (logout takes effect immediately)', async () => {
    tokens.verifyAccess.mockResolvedValue(claims);
    sessions.findActive.mockResolvedValue(null);
    await expect(run(fakeRequest({ authorization: 'Bearer ok' }))).rejects.toThrow(
      new UnauthorizedException('Session is no longer valid'),
    );
  });

  it('rejects a session that belongs to another user', async () => {
    tokens.verifyAccess.mockResolvedValue(claims);
    sessions.findActive.mockResolvedValue(buildSession({ id: session.id }));
    await expect(run(fakeRequest({ authorization: 'Bearer ok' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the principal and tags the request log with the user id', async () => {
    tokens.verifyAccess.mockResolvedValue(claims);
    sessions.findActive.mockResolvedValue(session);
    const request = fakeRequest({ authorization: 'Bearer ok' });

    await expect(run(request)).resolves.toBe(true);
    expect(request.user).toEqual({ id: session.userId, sessionId: session.id });
    expect(logger.assign).toHaveBeenCalledWith({ userId: session.userId });
  });
});
