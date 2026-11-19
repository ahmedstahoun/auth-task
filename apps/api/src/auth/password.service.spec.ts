import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeAll(async () => {
    await service.onModuleInit();
  });

  it('hashes with argon2id and verifies the original password', async () => {
    const hash = await service.hash('Str0ng!pass');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(service.verify(hash, 'Str0ng!pass')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('produces a different salted hash every time', async () => {
    expect(await service.hash('same-Pass1!')).not.toBe(await service.hash('same-Pass1!'));
  });

  it('refuses to hash passwords longer than 128 characters (hashing DoS)', async () => {
    await expect(service.hash('a'.repeat(129))).rejects.toBeInstanceOf(RangeError);
  });

  it('fails verification for over-long input without hashing it', async () => {
    const hash = await service.hash('Str0ng!pass');
    await expect(service.verify(hash, 'a'.repeat(129))).resolves.toBe(false);
  });

  it('treats a malformed hash as a failed verification instead of throwing', async () => {
    await expect(service.verify('not-a-hash', 'x')).resolves.toBe(false);
  });

  it('verifyDummy always fails', async () => {
    await expect(service.verifyDummy('anything')).resolves.toBe(false);
  });
});
