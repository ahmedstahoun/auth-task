import type { DeepMocked } from '@golevelup/ts-jest';
import { ConflictException } from '@nestjs/common';
import { buildUser } from '../../test/utils/factories';
import { mockUsersRepository } from '../../test/utils/mocks';
import { createTestingModule } from '../../test/utils/testing-module';
import { DuplicateEmailError } from '../repositories/errors/duplicate-email.error';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../repositories/interfaces/users-repository.interface';
import { EMAIL_TAKEN, UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: DeepMocked<UsersRepository>;
  const input = { email: 'jane@example.com', name: 'Jane Doe', passwordHash: 'hash' };

  beforeEach(async () => {
    repository = mockUsersRepository();
    const moduleRef = await createTestingModule({
      providers: [UsersService],
      overrides: [{ provide: USERS_REPOSITORY, useValue: repository }],
    });
    service = moduleRef.get(UsersService);
  });

  it('creates a user and returns a DTO without the hash', async () => {
    const user = buildUser();
    repository.create.mockResolvedValue(user);

    const dto = await service.create(input);

    expect(repository.create).toHaveBeenCalledWith(input);
    expect(dto).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    });
  });

  it('turns a duplicate email into 409 Conflict', async () => {
    repository.create.mockRejectedValue(new DuplicateEmailError());
    await expect(service.create(input)).rejects.toThrow(new ConflictException(EMAIL_TAKEN));
  });

  it('rethrows unexpected persistence errors untouched', async () => {
    const failure = new Error('connection lost');
    repository.create.mockRejectedValue(failure);
    await expect(service.create(input)).rejects.toBe(failure);
  });

  it('findById maps to a DTO or returns null', async () => {
    const user = buildUser();
    repository.findById.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    await expect(service.findById(user.id)).resolves.toMatchObject({ id: user.id });
    await expect(service.findById('missing')).resolves.toBeNull();
  });

  it('findCredentialsByEmail delegates to the repository', async () => {
    repository.findCredentialsByEmail.mockResolvedValue({ id: '1', passwordHash: 'h' });
    await expect(service.findCredentialsByEmail('jane@example.com')).resolves.toEqual({
      id: '1',
      passwordHash: 'h',
    });
  });
});
