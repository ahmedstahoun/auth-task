import type { UserDto } from '@auth/shared';
import type { UserRecord } from './user.schema';

/** The only way a user leaves the API: an explicit allow-list of fields. */
export function toUserDto(user: Pick<UserRecord, '_id' | 'email' | 'name' | 'createdAt'>): UserDto {
  return {
    id: user._id.toHexString(),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
