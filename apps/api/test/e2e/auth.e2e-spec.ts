import { apiErrorSchema, authResponseSchema, sessionDtoSchema, userDtoSchema } from '@auth/shared';
import {
  createTestApp,
  ORIGIN,
  parseSetCookie,
  refreshCookieFrom,
  validUser,
  type TestApp,
} from '../setup/app';

describe('Auth flow (e2e)', () => {
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

  const signUp = () => t.http().post('/auth/signup').send(validUser);

  describe('POST /auth/signup', () => {
    it('creates the account, returns an access token and sets a hardened refresh cookie', async () => {
      const res = await signUp().expect(201);

      const body = authResponseSchema.parse(res.body);
      expect(body.user).toMatchObject({ email: validUser.email, name: validUser.name });
      expect(JSON.stringify(res.body)).not.toMatch(/password|refresh/i);

      const [cookie] = parseSetCookie(res.headers['set-cookie']);
      expect(cookie?.name).toBe('refresh_token');
      expect(cookie?.attributes).toEqual(
        expect.arrayContaining(['HttpOnly', 'SameSite=Strict', 'Path=/auth']),
      );
    });

    it('stores a hash, never the password', async () => {
      await signUp().expect(201);
      const stored = await t.connection.collection('users').findOne({ email: validUser.email });
      expect(stored?.['passwordHash']).toMatch(/^\$argon2id\$/);
      expect(JSON.stringify(stored)).not.toContain(validUser.password);
    });

    it('rejects a duplicate email case-insensitively with 409', async () => {
      await signUp().expect(201);
      const res = await t
        .http()
        .post('/auth/signup')
        .send({ ...validUser, email: 'JANE@example.com' })
        .expect(409);
      expect(apiErrorSchema.parse(res.body).message).toBe(
        'An account with this email already exists',
      );
    });

    it('returns per-field validation errors', async () => {
      const res = await t
        .http()
        .post('/auth/signup')
        .send({ email: 'nope', name: 'ab', password: 'password' })
        .expect(400);
      const { details } = apiErrorSchema.parse(res.body);
      expect(details?.['email']).toEqual(['Enter a valid email address']);
      expect(details?.['name']).toEqual(['Name must be at least 3 characters']);
      expect(details?.['password']).toEqual([
        'Password must contain at least one number',
        'Password must contain at least one special character',
      ]);
    });
  });

  describe('POST /auth/signin + protected endpoint', () => {
    it('signs in and reaches GET /users/me with the access token', async () => {
      await signUp();
      const signIn = await t
        .http()
        .post('/auth/signin')
        .send({ email: validUser.email, password: validUser.password })
        .expect(200);
      const { accessToken } = authResponseSchema.parse(signIn.body);

      const me = await t
        .http()
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(userDtoSchema.parse(me.body).email).toBe(validUser.email);
    });

    it.each([
      ['no token', undefined],
      ['a malformed token', 'Bearer not-a-jwt'],
      ['a non-bearer scheme', 'Basic abc'],
    ])('rejects GET /users/me with %s', async (_label, header) => {
      const req = t.http().get('/users/me');
      const res = await (header ? req.set('Authorization', header) : req).expect(401);
      expect(apiErrorSchema.safeParse(res.body).success).toBe(true);
    });
  });

  describe('refresh rotation', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const first = await signUp();
      const cookie = refreshCookieFrom(first.headers['set-cookie']);

      const res = await t
        .http()
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .expect(200);
      authResponseSchema.parse(res.body);
      expect(refreshCookieFrom(res.headers['set-cookie'])).not.toBe(cookie);
    });

    it('detects reuse of a rotated token and revokes every session of the user', async () => {
      const first = await signUp();
      const original = refreshCookieFrom(first.headers['set-cookie']);
      const rotated = await t
        .http()
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', original)
        .expect(200);
      const { accessToken } = authResponseSchema.parse(rotated.body);

      // Attacker replays the old token.
      await t
        .http()
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', original)
        .expect(401);

      // The legitimate holder is logged out too — both tokens are dead.
      await t.http().get('/users/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      await t
        .http()
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', refreshCookieFrom(rotated.headers['set-cookie']))
        .expect(401);
    });

    it('rejects a refresh without a cookie and clears any cookie', async () => {
      const res = await t.http().post('/auth/refresh').set('Origin', ORIGIN).expect(401);
      expect(parseSetCookie(res.headers['set-cookie'])[0]?.value).toBe('');
    });
  });

  describe('logout', () => {
    it('ends the session immediately: access and refresh tokens stop working', async () => {
      const res = await signUp();
      const { accessToken } = authResponseSchema.parse(res.body);
      const cookie = refreshCookieFrom(res.headers['set-cookie']);

      const logout = await t
        .http()
        .post('/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .expect(204);
      expect(parseSetCookie(logout.headers['set-cookie'])[0]?.value).toBe('');

      await t.http().get('/users/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      await t.http().post('/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie).expect(401);
    });

    it('is idempotent without a cookie', async () => {
      await t.http().post('/auth/logout').set('Origin', ORIGIN).expect(204);
    });

    it('logout-all ends every session of the user', async () => {
      const a = authResponseSchema.parse((await signUp()).body);
      const b = authResponseSchema.parse(
        (
          await t
            .http()
            .post('/auth/signin')
            .send({ email: validUser.email, password: validUser.password })
        ).body,
      );

      const sessions = await t
        .http()
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);
      const list = sessionDtoSchema.array().parse(sessions.body);
      expect(list).toHaveLength(2);
      expect(list.filter((s) => s.current)).toHaveLength(1);

      await t
        .http()
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(204);
      await t.http().get('/users/me').set('Authorization', `Bearer ${b.accessToken}`).expect(401);
    });
  });

  describe('observability', () => {
    it('returns a request id on every response and echoes a valid incoming one', async () => {
      const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
      const res = await t.http().get('/users/me').set('X-Request-Id', id).expect(401);
      expect(res.headers['x-request-id']).toBe(id);
      expect(apiErrorSchema.parse(res.body).requestId).toBe(id);
    });

    it('GET /health reports MongoDB as up', async () => {
      const res = await t.http().get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', info: { mongodb: { status: 'up' } } });
    });
  });
});
