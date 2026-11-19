import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, type Types } from 'mongoose';
import { isDuplicateKeyError } from '../../database/mongo-errors';
import { DuplicateEmailError } from '../errors/duplicate-email.error';
import type { UsersRepository } from '../interfaces/users-repository.interface';
import type { NewUser, User, UserCredentials } from '../models/user.model';
import { USER_MODEL, type UserDocument } from '../schemas/user.schema';

type StoredUser = Pick<UserDocument, 'email' | 'name' | 'createdAt'> & { _id: Types.ObjectId };

function toUser(doc: StoredUser): User {
  return { id: doc._id.toHexString(), email: doc.email, name: doc.name, createdAt: doc.createdAt };
}

@Injectable()
export class MongoUsersRepository implements UsersRepository {
  constructor(@InjectModel(USER_MODEL) private readonly users: Model<UserDocument>) {}

  async create(user: NewUser): Promise<User> {
    try {
      return toUser(await this.users.create(user));
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) throw new DuplicateEmailError();
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.users.findById(id).lean().exec();
    return doc ? toUser(doc) : null;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const doc = await this.users.findOne({ email }).select('+passwordHash').lean().exec();
    return doc ? { id: doc._id.toHexString(), passwordHash: doc.passwordHash } : null;
  }
}
