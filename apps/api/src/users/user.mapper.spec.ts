import { Types } from 'mongoose';
import { toUserDto } from './user.mapper';

describe('toUserDto', () => {
  it('exposes only id, email, name and createdAt', () => {
    const _id = new Types.ObjectId();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const doc = { _id, email: 'a@b.co', name: 'Jane', createdAt, passwordHash: 'secret' };
    expect(toUserDto(doc)).toEqual({
      id: _id.toHexString(),
      email: 'a@b.co',
      name: 'Jane',
      createdAt: createdAt.toISOString(),
    });
  });
});
