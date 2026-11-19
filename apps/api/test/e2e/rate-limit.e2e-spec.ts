import { createTestApp, type TestApp } from '../setup/app';

describe('Rate limiting (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '3', LOCKOUT_MAX_ATTEMPTS: '100' });
  });
  afterAll(async () => {
    await t.close();
  });

  it('returns 429 once an IP exceeds the auth limit', async () => {
    const attempt = () => t.http().post('/auth/signin').send({ email: 'a@b.co', password: 'x' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    await attempt().expect(429);
  });

  it('does not throttle non-credential endpoints with the auth limit', async () => {
    for (let i = 0; i < 5; i++) await t.http().get('/users/me').expect(401);
  });
});
