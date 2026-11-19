import { buildUser } from '../../../test/utils/factories';
import { toUserDto } from './user.mapper';

describe('toUserDto', () => {
  it('exposes only id, email, name and createdAt (as ISO string)', () => {
    const user = buildUser();
    const withExtras = { ...user, passwordHash: 'secret' };
    expect(toUserDto(withExtras)).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    });
  });
});
