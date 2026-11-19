/** Persistence-agnostic signal that the unique email constraint was violated. */
export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'DuplicateEmailError';
  }
}
