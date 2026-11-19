import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PASSWORD_MAX_LENGTH } from '@auth/shared';
import * as argon2 from 'argon2';

/** OWASP-recommended argon2id baseline (19 MiB, 2 iterations, 1 lane). */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  /** Pre-computed so sign-in for an unknown email costs the same as a wrong password. */
  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('dummy-password-for-timing-equalisation', ARGON2_OPTIONS);
  }

  async hash(password: string): Promise<string> {
    this.assertLength(password);
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    if (password.length > PASSWORD_MAX_LENGTH) return false;
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Burns the same CPU as a real verification and always fails. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(this.dummyHash, password);
    return false;
  }

  private assertLength(password: string): void {
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new RangeError(`Password exceeds ${String(PASSWORD_MAX_LENGTH)} characters`);
    }
  }
}
