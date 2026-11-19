import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound protects the password hasher from very long inputs (hashing DoS). */
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 64;

const LETTER = /[A-Za-z]/;
const NUMBER = /\d/;
/** Any printable character that is not a letter, digit or whitespace. */
const SPECIAL = /[^A-Za-z0-9\s]/;

export interface PasswordRule {
  readonly id: 'length' | 'letter' | 'number' | 'special';
  readonly label: string;
  readonly test: (value: string) => boolean;
}

/** Single source of truth for password rules — used by the schema and by the UI checklist. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${String(PASSWORD_MIN_LENGTH)} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'letter', label: 'At least one letter', test: (v) => LETTER.test(v) },
  { id: 'number', label: 'At least one number', test: (v) => NUMBER.test(v) },
  { id: 'special', label: 'At least one special character', test: (v) => SPECIAL.test(v) },
];

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'Email is too long' })
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(NAME_MIN_LENGTH, { error: `Name must be at least ${String(NAME_MIN_LENGTH)} characters` })
  .max(NAME_MAX_LENGTH, { error: `Name must be at most ${String(NAME_MAX_LENGTH)} characters` });

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_MIN_LENGTH, {
    error: `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `Password must be at most ${String(PASSWORD_MAX_LENGTH)} characters`,
  })
  .regex(LETTER, { error: 'Password must contain at least one letter' })
  .regex(NUMBER, { error: 'Password must contain at least one number' })
  .regex(SPECIAL, { error: 'Password must contain at least one special character' });

export const signUpSchema = z
  .object({
    email: emailSchema,
    name: nameSchema,
    password: passwordSchema,
  })
  .strict();

/**
 * Sign-in deliberately does not re-apply the sign-up password policy:
 * it would leak policy details and lock out users if the policy ever changes.
 */
export const signInSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ error: 'Password is required' })
      .min(1, { error: 'Password is required' })
      .max(PASSWORD_MAX_LENGTH, { error: 'Invalid credentials' }),
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
