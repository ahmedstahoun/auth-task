import { randomUUID } from 'node:crypto';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Model } from 'mongoose';
import { applyMongooseHardening } from '../../src/common/mongo/mongo.config';
import { sha256 } from '../../src/sessions/hash';
import { SESSION_MODEL, type SessionDocument } from '../../src/sessions/session.schemas';
import { SessionStore, type NewSession } from '../../src/sessions/session-store';
import { SessionsModule } from '../../src/sessions/sessions.module';

describe('MongoSessionStore (integration)', () => {
  let moduleRef: TestingModule;
  let store: SessionStore;
  let sessions: Model<SessionDocument>;

  beforeAll(async () => {
    applyMongooseHardening();
    moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(process.env['MONGO_URI'] ?? ''), SessionsModule],
    }).compile();
    store = moduleRef.get(SessionStore);
    sessions = moduleRef.get(getModelToken(SESSION_MODEL));
    await sessions.init();
  });

  afterAll(async () => {
    await sessions.db.dropDatabase();
    await moduleRef.close();
  });

  beforeEach(async () => {
    await sessions.db.collection('sessions').deleteMany({});
    await sessions.db.collection('login_attempts').deleteMany({});
  });

  const newSession = (overrides: Partial<NewSession> = {}): NewSession => ({
    id: randomUUID(),
    userId: 'user-1',
    refreshJti: randomUUID(),
    userAgent: 'jest',
    ip: '127.0.0.1',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  it('stores only a hash of the refresh jti', async () => {
    const input = newSession();
    await store.create(input);
    const raw = await sessions.db
      .collection('sessions')
      .findOne({ _id: { $eq: input.id } as never });
    expect(raw?.['refreshJtiHash']).toBe(sha256(input.refreshJti));
    expect(JSON.stringify(raw)).not.toContain(input.refreshJti);
  });

  it('ignores expired sessions even before the TTL monitor deletes them', async () => {
    const input = newSession({ expiresAt: new Date(Date.now() - 1000) });
    await store.create(input);
    await expect(store.findActive(input.id)).resolves.toBeNull();
    await expect(store.rotate(input.id, input.refreshJti, randomUUID())).resolves.toEqual({
      status: 'not_found',
    });
  });

  it('declares a TTL index on expiresAt', async () => {
    const indexes = await sessions.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
      ]),
    );
  });

  it('rotates with the current jti and detects reuse of the old one', async () => {
    const input = newSession();
    await store.create(input);
    const next = randomUUID();

    await expect(store.rotate(input.id, input.refreshJti, next)).resolves.toMatchObject({
      status: 'rotated',
    });
    await expect(store.rotate(input.id, input.refreshJti, randomUUID())).resolves.toEqual({
      status: 'reuse_detected',
      userId: 'user-1',
    });
    await expect(store.rotate(input.id, next, randomUUID())).resolves.toMatchObject({
      status: 'rotated',
    });
  });

  it('lets exactly one of two concurrent refreshes win', async () => {
    const input = newSession();
    await store.create(input);
    const results = await Promise.all([
      store.rotate(input.id, input.refreshJti, randomUUID()),
      store.rotate(input.id, input.refreshJti, randomUUID()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['reuse_detected', 'rotated']);
  });

  it('revokes one session or all of a user', async () => {
    const a = newSession();
    const b = newSession();
    const other = newSession({ userId: 'user-2' });
    await Promise.all([store.create(a), store.create(b), store.create(other)]);

    await store.revoke(a.id);
    await expect(store.findActive(a.id)).resolves.toBeNull();
    await expect(store.revokeAllForUser('user-1')).resolves.toBe(1);
    await expect(store.listActiveForUser('user-2')).resolves.toHaveLength(1);
  });

  it('counts failed logins within a window and resets after it', async () => {
    await expect(store.registerFailedLogin('a@b.co', 60)).resolves.toBe(1);
    await expect(store.registerFailedLogin('a@b.co', 60)).resolves.toBe(2);
    await expect(store.countFailedLogins('a@b.co')).resolves.toBe(2);

    await sessions.db
      .collection('login_attempts')
      .updateOne(
        { _id: { $eq: 'a@b.co' } as never },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
    await expect(store.countFailedLogins('a@b.co')).resolves.toBe(0);
    await expect(store.registerFailedLogin('a@b.co', 60)).resolves.toBe(1);

    await store.clearFailedLogins('a@b.co');
    await expect(store.countFailedLogins('a@b.co')).resolves.toBe(0);
  });
});
