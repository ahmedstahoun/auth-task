import { DuplicateEmailError } from '../../src/repositories/errors/duplicate-email.error';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../src/repositories/interfaces/users-repository.interface';
import { createRepositoriesContext, type RepositoriesTestContext } from './repositories-module';

describe('MongoUsersRepository (integration)', () => {
  let ctx: RepositoriesTestContext;
  let repository: UsersRepository;

  beforeAll(async () => {
    ctx = await createRepositoriesContext();
    repository = ctx.moduleRef.get<UsersRepository>(USERS_REPOSITORY);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await ctx.clear();
  });

  const input = { email: 'jane@example.com', name: 'Jane', passwordHash: 'hash' };

  it('creates a user and returns a domain model without the hash', async () => {
    const user = await repository.create(input);
    expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name']);
    expect(user.createdAt).toBeInstanceOf(Date);
    await expect(repository.findById(user.id)).resolves.toEqual(user);
  });

  it('enforces unique emails case-insensitively with a domain error', async () => {
    await repository.create(input);
    await expect(repository.create({ ...input, email: 'JANE@example.com' })).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
  });

  it('returns credentials only through the dedicated lookup', async () => {
    const user = await repository.create(input);
    await expect(repository.findCredentialsByEmail(input.email)).resolves.toEqual({
      id: user.id,
      passwordHash: 'hash',
    });
    await expect(repository.findCredentialsByEmail('nobody@example.com')).resolves.toBeNull();
  });

  it('returns null for malformed or unknown ids instead of throwing', async () => {
    await expect(repository.findById('not-an-object-id')).resolves.toBeNull();
    await expect(repository.findById('665f1f77bcf86cd799439011')).resolves.toBeNull();
  });

  it('never lets an operator object match users (defence in depth behind zod)', async () => {
    await repository.create(input);
    const injected = { $ne: null } as unknown as string;
    // `email` is a String path, so Mongoose's casting rejects the operator object outright;
    // sanitizeFilter covers paths without a schema type. Either way, nothing is matched.
    await expect(repository.findCredentialsByEmail(injected)).rejects.toThrow(
      /Cast to string failed/,
    );
  });
});
