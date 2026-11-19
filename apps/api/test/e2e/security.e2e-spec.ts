import { apiErrorSchema, authResponseSchema } from '@auth/shared';
import { createTestApp, ORIGIN, refreshCookieFrom, validUser, type TestApp } from '../setup/app';

describe('Security (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await t.reset();
  });

  const signIn = (body: object) => t.http().post('/auth/signin').send(body);
  const comparable = (body: unknown) => {
    const { timestamp: _t, requestId: _r, ...rest } = apiErrorSchema.parse(body);
    return rest;
  };

  it('returns an identical response for an unknown email and a wrong password', async () => {
    await t.http().post('/auth/signup').send(validUser).expect(201);
    const unknown = await signIn({ email: 'ghost@example.com', password: 'Whatever1!' });
    const wrong = await signIn({ email: validUser.email, password: 'Wrong-pass1!' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(comparable(unknown.body)).toEqual(comparable(wrong.body));
  });

  it('locks the account after 5 failures, even for the correct password', async () => {
    await t.http().post('/auth/signup').send(validUser).expect(201);
    for (let i = 0; i < 5; i++) {
      await signIn({ email: validUser.email, password: 'Wrong-pass1!' }).expect(401);
    }
    const res = await signIn({ email: validUser.email, password: validUser.password }).expect(429);
    expect(apiErrorSchema.parse(res.body).message).toMatch(/too many failed sign-in attempts/i);
  });

  it.each([
    ['operator object as email', { email: { $gt: '' }, password: 'x' }],
    ['operator object as password', { email: validUser.email, password: { $ne: null } }],
    ['unknown keys', { ...validUser, role: 'admin' }],
  ])('rejects %s with 400 (NoSQL injection / mass assignment)', async (_label, body) => {
    await t.http().post('/auth/signup').send(validUser);
    await t.http().post('/auth/signin').send(body).expect(400);
  });

  it('never returns passwordHash from any endpoint', async () => {
    const signUp = await t.http().post('/auth/signup').send(validUser);
    const { accessToken } = authResponseSchema.parse(signUp.body);
    const me = await t.http().get('/users/me').set('Authorization', `Bearer ${accessToken}`);
    for (const body of [signUp.body, me.body]) {
      expect(JSON.stringify(body)).not.toContain('passwordHash');
      expect(JSON.stringify(body)).not.toContain('$argon2');
    }
  });

  describe('CSRF protection on cookie endpoints', () => {
    it.each([
      ['a foreign Origin', 'https://evil.example'],
      ['no Origin', undefined],
    ])('rejects refresh with %s (403)', async (_label, origin) => {
      const signUp = await t.http().post('/auth/signup').send(validUser);
      const req = t
        .http()
        .post('/auth/refresh')
        .set('Cookie', refreshCookieFrom(signUp.headers['set-cookie']));
      await (origin ? req.set('Origin', origin) : req).expect(403);
    });

    it('accepts the configured Origin', async () => {
      const signUp = await t.http().post('/auth/signup').send(validUser);
      await t
        .http()
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', refreshCookieFrom(signUp.headers['set-cookie']))
        .expect(200);
    });
  });

  describe('HTTP hardening', () => {
    it('rejects bodies larger than 10kb', async () => {
      await t
        .http()
        .post('/auth/signup')
        .send({ ...validUser, name: 'x'.repeat(11_000) })
        .expect(413);
      // (body shape asserted by the unit test of the exception filter)
    });

    it('answers malformed JSON with 400 and a fixed message', async () => {
      const res = await t
        .http()
        .post('/auth/signin')
        .set('Content-Type', 'application/json')
        .send('{"email":"a@b.co",}')
        .expect(400);
      expect(apiErrorSchema.parse(res.body).message).toBe('Malformed JSON body');
    });

    it('ignores non-JSON bodies (JSON-only API)', async () => {
      await t.http().post('/auth/signin').type('form').send('email=a@b.co&password=x').expect(400);
    });

    it('sets security headers and hides the framework', async () => {
      const res = await t.http().get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('answers CORS preflight only for the allowed origin', async () => {
      const ok = await t
        .http()
        .options('/auth/signin')
        .set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'POST');
      expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(ok.headers['access-control-allow-credentials']).toBe('true');

      const evil = await t
        .http()
        .options('/auth/signin')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
