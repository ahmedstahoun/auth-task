import { ConflictException } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Model } from 'mongoose';
import { applyMongooseHardening } from '../../src/common/mongo/mongo.config';
import { USER_MODEL, userSchema, type User } from '../../src/users/user.schema';
import { UsersService } from '../../src/users/users.service';

describe('UsersService (integration)', () => {
  let moduleRef: TestingModule;
  let service: UsersService;
  let users: Model<User>;

  beforeAll(async () => {
    applyMongooseHardening();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(process.env['MONGO_URI'] ?? ''),
        MongooseModule.forFeature([{ name: USER_MODEL, schema: userSchema }]),
      ],
      providers: [UsersService],
    }).compile();
    service = moduleRef.get(UsersService);
    users = moduleRef.get(getModelToken(USER_MODEL));
    await users.init();
  });

  afterAll(async () => {
    await users.db.dropDatabase();
    await moduleRef.close();
  });

  beforeEach(async () => {
    await users.deleteMany({});
  });

  const input = { email: 'jane@example.com', name: 'Jane', passwordHash: 'hash' };

  it('creates a user and never exposes the hash', async () => {
    const dto = await service.create(input);
    expect(Object.keys(dto).sort()).toEqual(['createdAt', 'email', 'id', 'name']);
    expect(dto).toMatchObject({ email: input.email, name: 'Jane' });
    await expect(service.findById(dto.id)).resolves.toEqual(dto);
  });

  it('enforces unique emails', async () => {
    await service.create(input);
    await expect(service.create({ ...input, email: 'JANE@example.com' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns credentials only through the dedicated lookup', async () => {
    const dto = await service.create(input);
    await expect(service.findCredentialsByEmail(input.email)).resolves.toEqual({
      id: dto.id,
      passwordHash: 'hash',
    });
    await expect(service.findCredentialsByEmail('nobody@example.com')).resolves.toBeNull();
  });

  it('returns null for malformed or unknown ids instead of throwing', async () => {
    await expect(service.findById('not-an-object-id')).resolves.toBeNull();
    await expect(service.findById('665f1f77bcf86cd799439011')).resolves.toBeNull();
  });

  it('neutralises operator injection in filters (sanitizeFilter)', async () => {
    await service.create(input);
    const injected = { $ne: null } as unknown as string;
    await expect(service.findCredentialsByEmail(injected)).resolves.toBeNull();
  });
});
