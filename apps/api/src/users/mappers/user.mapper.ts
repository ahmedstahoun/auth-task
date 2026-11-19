import type { UserDto } from '@auth/shared';
import type { User } from '../../repositories/models/user.model';

/** The only way a user leaves the API: an explicit allow-list of fields. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
