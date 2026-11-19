import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { UserDto } from '@auth/shared';
import { DuplicateEmailError } from '../repositories/errors/duplicate-email.error';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../repositories/interfaces/users-repository.interface';
import type { NewUser, UserCredentials } from '../repositories/models/user.model';
import { toUserDto } from './mappers/user.mapper';

export const EMAIL_TAKEN = 'An account with this email already exists';

/** User use-cases. Talks to persistence only through the UsersRepository interface. */
@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly users: UsersRepository) {}

  async create(input: NewUser): Promise<UserDto> {
    try {
      return toUserDto(await this.users.create(input));
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError) throw new ConflictException(EMAIL_TAKEN);
      throw error;
    }
  }

  async findById(id: string): Promise<UserDto | null> {
    const user = await this.users.findById(id);
    return user ? toUserDto(user) : null;
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.users.findCredentialsByEmail(email);
  }
}
