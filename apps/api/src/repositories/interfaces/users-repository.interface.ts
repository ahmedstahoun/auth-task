import type { NewUser, User, UserCredentials } from '../models/user.model';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface UsersRepository {
  /** @throws DuplicateEmailError when the (normalised) email already exists. */
  create(user: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
}
