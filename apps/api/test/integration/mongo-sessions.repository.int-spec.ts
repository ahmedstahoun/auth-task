import { randomUUID } from 'node:crypto';
import { sha256 } from '../../src/common/utils/hash';
import {
  SESSIONS_REPOSITORY,
  type SessionsRepository,
} from '../../src/repositories/interfaces/sessions-repository.interface';
import type { NewSession } from '../../src/repositories/models/session.model';
import { createRepositoriesContext, type RepositoriesTestContext } from './repositories-module';

describe('MongoSessionsRepository (integration)', () => {
  let ctx: RepositoriesTestContext;
  let repository: SessionsRepository;

  beforeAll(async () => {
    ctx = await createRepositoriesContext();
    repository = ctx.moduleRef.get<SessionsRepository>(SESSIONS_REPOSITORY);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await ctx.clear();
  });

  const sessions = () =>
    ctx.connection.collection<{ _id: string; refreshJtiHash: string }>('sessions');
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
    await repository.create(input);
    const raw = await sessions().findOne({ _id: input.id });
    expect(raw?.refreshJtiHash).toBe(sha256(input.refreshJti));
    expect(JSON.stringify(raw)).not.toContain(input.refreshJti);
  });

  it('declares a TTL index on expiresAt', async () => {
    const indexes = await sessions().indexes();
    expect(indexes.some((i) => i.key['expiresAt'] === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });

  it('ignores expired sessions even before the TTL monitor deletes them', async () => {
    const input = newSession({ expiresAt: new Date(Date.now() - 1000) });
    await repository.create(input);
    await expect(repository.findActive(input.id)).resolves.toBeNull();
    await expect(repository.rotate(input.id, input.refreshJti, randomUUID())).resolves.toEqual({
      status: 'not_found',
    });
  });

  it('rotates with the current jti and detects reuse of the old one', async () => {
    const input = newSession();
    await repository.create(input);
    const next = randomUUID();

    await expect(repository.rotate(input.id, input.refreshJti, next)).resolves.toMatchObject({
      status: 'rotated',
    });
    await expect(repository.rotate(input.id, input.refreshJti, randomUUID())).resolves.toEqual({
      status: 'reuse_detected',
      userId: 'user-1',
    });
    await expect(repository.rotate(input.id, next, randomUUID())).resolves.toMatchObject({
      status: 'rotated',
    });
  });

  it('lets exactly one of two concurrent refreshes win', async () => {
    const input = newSession();
    await repository.create(input);
    const results = await Promise.all([
      repository.rotate(input.id, input.refreshJti, randomUUID()),
      repository.rotate(input.id, input.refreshJti, randomUUID()),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['reuse_detected', 'rotated']);
  });

  it('revokes one session or all of a user', async () => {
    const a = newSession();
    const b = newSession();
    const other = newSession({ userId: 'user-2' });
    await Promise.all([repository.create(a), repository.create(b), repository.create(other)]);

    await repository.revoke(a.id);
    await expect(repository.findActive(a.id)).resolves.toBeNull();
    await expect(repository.revokeAllForUser('user-1')).resolves.toBe(1);
    await expect(repository.listActiveForUser('user-2')).resolves.toHaveLength(1);
  });
});
