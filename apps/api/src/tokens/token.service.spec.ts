import { JwtService } from '@nestjs/jwt';
import { mockConfig } from '../../test/utils/mocks';
import { TokenService } from './token.service';

const USER_ID = '665f1f77bcf86cd799439011';
const SESSION_ID = '5f7a3b1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('TokenService', () => {
  const jwt = new JwtService();
  const service = new TokenService(jwt, mockConfig());

  it('issues an access token with sub, sid, jti, typ, iss and aud', async () => {
    const { token, jti, expiresAt } = await service.signAccess(USER_ID, SESSION_ID);
    const claims = await service.verifyAccess(token);

    expect(claims).toMatchObject({ sub: USER_ID, sid: SESSION_ID, jti, typ: 'access' });
    expect(jwt.decode<Record<string, unknown>>(token)).toMatchObject({
      iss: 'auth-task-api',
      aud: 'auth-task-web',
    });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never accepts a refresh token as an access token (and vice versa)', async () => {
    const access = await service.signAccess(USER_ID, SESSION_ID);
    const refresh = await service.signRefresh(USER_ID, SESSION_ID, new Date(Date.now() + 60_000));

    await expect(service.verifyAccess(refresh.token)).resolves.toBeNull();
    await expect(service.verifyRefresh(access.token)).resolves.toBeNull();
    await expect(service.verifyRefresh(refresh.token)).resolves.toMatchObject({ typ: 'refresh' });
  });

  it('ties refresh token expiry to the session expiry', async () => {
    const sessionExpiresAt = new Date(Date.now() + 120_000);
    const { token } = await service.signRefresh(USER_ID, SESSION_ID, sessionExpiresAt);
    const claims = await service.verifyRefresh(token);
    expect(claims?.exp).toBeCloseTo(Math.floor(sessionExpiresAt.getTime() / 1000), -1);
  });

  it('rejects tokens signed with another secret', async () => {
    const forged = await jwt.signAsync(
      { sid: SESSION_ID, typ: 'access' },
      {
        secret: 'x'.repeat(40),
        subject: USER_ID,
        jwtid: SESSION_ID,
        issuer: 'auth-task-api',
        audience: 'auth-task-web',
      },
    );
    await expect(service.verifyAccess(forged)).resolves.toBeNull();
  });

  it.each([
    ['issuer', { JWT_ISSUER: 'someone-else' }],
    ['audience', { JWT_AUDIENCE: 'someone-else' }],
  ])('rejects tokens with the wrong %s', async (_label, env) => {
    const other = new TokenService(jwt, mockConfig(env));
    const { token } = await other.signAccess(USER_ID, SESSION_ID);
    await expect(service.verifyAccess(token)).resolves.toBeNull();
  });

  it('rejects expired tokens', async () => {
    const shortLived = new TokenService(jwt, mockConfig({ JWT_ACCESS_TTL_SECONDS: 1 }));
    const { token } = await shortLived.signAccess(USER_ID, SESSION_ID);
    jest.useFakeTimers({ now: Date.now() + 5_000 });
    try {
      await expect(service.verifyAccess(token)).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects the "none" algorithm and malformed tokens', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: USER_ID, sid: SESSION_ID, typ: 'access' }),
    ).toString('base64url');
    await expect(service.verifyAccess(`${header}.${payload}.`)).resolves.toBeNull();
    await expect(service.verifyAccess('garbage')).resolves.toBeNull();
  });

  it('rejects validly-signed tokens whose claims do not match the expected shape', async () => {
    const token = await jwt.signAsync(
      { typ: 'access' },
      {
        secret: 'test-access-secret-test-access-secret-0000',
        subject: USER_ID,
        issuer: 'auth-task-api',
        audience: 'auth-task-web',
      },
    );
    await expect(service.verifyAccess(token)).resolves.toBeNull();
  });
});
