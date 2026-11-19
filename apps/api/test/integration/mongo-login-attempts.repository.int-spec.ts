import {
  LOGIN_ATTEMPTS_REPOSITORY,
  type LoginAttemptsRepository,
} from '../../src/repositories/interfaces/login-attempts-repository.interface';
import { createRepositoriesContext, type RepositoriesTestContext } from './repositories-module';

describe('MongoLoginAttemptsRepository (integration)', () => {
  let ctx: RepositoriesTestContext;
  let repository: LoginAttemptsRepository;

  beforeAll(async () => {
    ctx = await createRepositoriesContext();
    repository = ctx.moduleRef.get<LoginAttemptsRepository>(LOGIN_ATTEMPTS_REPOSITORY);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await ctx.clear();
  });

  it('counts failures within a window and restarts after it', async () => {
    await expect(repository.registerFailure('a@b.co', 60)).resolves.toBe(1);
    await expect(repository.registerFailure('a@b.co', 60)).resolves.toBe(2);
    await expect(repository.countFailures('a@b.co')).resolves.toBe(2);

    await ctx.connection
      .collection<{ _id: string }>('login_attempts')
      .updateOne({ _id: 'a@b.co' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(repository.countFailures('a@b.co')).resolves.toBe(0);
    await expect(repository.registerFailure('a@b.co', 60)).resolves.toBe(1);
  });

  it('keeps counters per email and clears them', async () => {
    await repository.registerFailure('a@b.co', 60);
    await repository.registerFailure('c@d.co', 60);
    await repository.clear('a@b.co');
    await expect(repository.countFailures('a@b.co')).resolves.toBe(0);
    await expect(repository.countFailures('c@d.co')).resolves.toBe(1);
  });

  it('is atomic under concurrent failures', async () => {
    await Promise.all(Array.from({ length: 10 }, () => repository.registerFailure('a@b.co', 60)));
    await expect(repository.countFailures('a@b.co')).resolves.toBe(10);
  });
});
