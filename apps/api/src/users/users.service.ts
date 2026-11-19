import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { UserDto } from '@auth/shared';
import { isValidObjectId, Model } from 'mongoose';
import { isDuplicateKeyError } from '../common/mongo/mongo-errors';
import { toUserDto } from './user.mapper';
import { USER_MODEL, type User } from './user.schema';

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UserCredentials {
  id: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(USER_MODEL) private readonly users: Model<User>) {}

  async create(input: NewUser): Promise<UserDto> {
    try {
      const created = await this.users.create(input);
      return toUserDto(created);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.users.findOne({ email }).select('+passwordHash').lean().exec();
    return user ? { id: user._id.toHexString(), passwordHash: user.passwordHash } : null;
  }

  async findById(id: string): Promise<UserDto | null> {
    if (!isValidObjectId(id)) return null;
    const user = await this.users.findById(id).lean().exec();
    return user ? toUserDto(user) : null;
  }
}
