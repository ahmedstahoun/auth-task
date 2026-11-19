import { createMock } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { buildUserDto } from '../../test/utils/factories';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

describe('UsersController', () => {
  it('GET /users/me returns the current user', async () => {
    const user = buildUserDto();
    const users = createMock<UsersService>();
    users.findById.mockResolvedValue(user);
    await expect(new UsersController(users).me({ id: user.id, sessionId: 's' })).resolves.toEqual(
      user,
    );
  });

  it('GET /users/me returns 404 if the account no longer exists', async () => {
    const users = createMock<UsersService>();
    users.findById.mockResolvedValue(null);
    await expect(new UsersController(users).me({ id: 'x', sessionId: 's' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
