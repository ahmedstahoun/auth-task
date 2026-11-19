import { signUpSchema } from '@auth/shared';
import { z } from 'zod';
import { buildSignUpInput } from '../../../test/utils/factories';
import { ZodValidationException } from '../exceptions/zod-validation.exception';
import { toValidationDetails, ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(signUpSchema);

  it('returns the parsed (normalised) value', () => {
    expect(pipe.transform(buildSignUpInput({ email: ' Jane@Example.com ' })).email).toBe(
      'jane@example.com',
    );
  });

  it('throws a 400 with per-field details', () => {
    let error: unknown;
    try {
      pipe.transform({ email: 'nope', name: 'ab', password: 'weak' });
    } catch (e: unknown) {
      error = e;
    }
    expect(error).toBeInstanceOf(ZodValidationException);
    const { details } = error as ZodValidationException;
    expect(Object.keys(details).sort()).toEqual(['email', 'name', 'password']);
    expect(details['password']).toContain('Password must contain at least one number');
  });

  it('reports root-level problems under _root', () => {
    const result = z.string().safeParse(42);
    if (result.success) throw new Error('expected failure');
    expect(Object.keys(toValidationDetails(result.error))).toEqual(['_root']);
  });
});
