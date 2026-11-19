export const LOGIN_ATTEMPTS_REPOSITORY = Symbol('LOGIN_ATTEMPTS_REPOSITORY');

/** Failed sign-in counters per email, used for temporary lockout. */
export interface LoginAttemptsRepository {
  /** Increments within the current window (which starts at the first failure) and returns the count. */
  registerFailure(email: string, windowSeconds: number): Promise<number>;
  countFailures(email: string): Promise<number>;
  clear(email: string): Promise<void>;
}
