import { describe, expect, it } from 'vitest';
import { PASSWORD_RULES, signInSchema, signUpSchema, type SignUpInput } from './auth.schemas';

const valid: SignUpInput = { email: 'jane@example.com', name: 'Jane', password: 'Str0ng!pass' };

function issuesFor(input: unknown): string[] {
  const result = signUpSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('signUpSchema', () => {
  it('accepts a valid payload', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('normalizes email (trim + lowercase)', () => {
    const parsed = signUpSchema.parse({ ...valid, email: '  Jane@Example.COM ' });
    expect(parsed.email).toBe('jane@example.com');
  });

  it('trims the name', () => {
    expect(signUpSchema.parse({ ...valid, name: '  Jane  ' }).name).toBe('Jane');
  });

  it.each(['not-an-email', 'a@', '@b.com', 'a b@c.com'])('rejects invalid email %s', (email) => {
    expect(issuesFor({ ...valid, email })).toContain('Enter a valid email address');
  });

  it('rejects a name shorter than 3 characters (after trimming)', () => {
    expect(issuesFor({ ...valid, name: ' ab ' })).toContain('Name must be at least 3 characters');
  });

  it.each([
    ['too short', 'Ab1!', 'Password must be at least 8 characters'],
    ['no letter', '12345678!', 'Password must contain at least one letter'],
    ['no number', 'Password!', 'Password must contain at least one number'],
    ['no special character', 'Password1', 'Password must contain at least one special character'],
    [
      'only whitespace as "special"',
      'Password 1',
      'Password must contain at least one special character',
    ],
  ])('rejects a password with %s', (_case, password, message) => {
    expect(issuesFor({ ...valid, password })).toContain(message);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(issuesFor({ ...valid, password: `Aa1!${'x'.repeat(125)}` })).toContain(
      'Password must be at most 128 characters',
    );
  });

  it('rejects unknown keys (blocks mass assignment)', () => {
    expect(signUpSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });

  it('rejects operator objects instead of strings (NoSQL injection)', () => {
    expect(signUpSchema.safeParse({ ...valid, email: { $gt: '' } }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('does not apply the sign-up password policy', () => {
    expect(signInSchema.safeParse({ email: 'jane@example.com', password: 'weak' }).success).toBe(
      true,
    );
  });

  it('requires a password', () => {
    expect(signInSchema.safeParse({ email: 'jane@example.com', password: '' }).success).toBe(false);
  });

  it('rejects operator objects', () => {
    expect(signInSchema.safeParse({ email: { $ne: null }, password: { $ne: null } }).success).toBe(
      false,
    );
  });
});

describe('PASSWORD_RULES', () => {
  const byId = (id: string): (typeof PASSWORD_RULES)[number] => {
    const rule = PASSWORD_RULES.find((r) => r.id === id);
    if (!rule) throw new Error(`missing rule ${id}`);
    return rule;
  };

  it('evaluates each rule independently', () => {
    expect(byId('length').test('1234567')).toBe(false);
    expect(byId('length').test('12345678')).toBe(true);
    expect(byId('letter').test('123')).toBe(false);
    expect(byId('letter').test('a')).toBe(true);
    expect(byId('number').test('abc')).toBe(false);
    expect(byId('number').test('a1')).toBe(true);
    expect(byId('special').test('abc 1')).toBe(false);
    expect(byId('special').test('a_')).toBe(true);
  });

  it('agrees with the schema: all rules pass ⇔ schema accepts', () => {
    for (const password of ['Str0ng!pass', 'weak', 'NoSpecial1', 'n0-letters?x']) {
      const allPass = PASSWORD_RULES.every((r) => r.test(password));
      expect(signUpSchema.safeParse({ ...valid, password }).success).toBe(allPass);
    }
  });
});
