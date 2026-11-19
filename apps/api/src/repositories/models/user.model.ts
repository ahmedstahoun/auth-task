/** A user as the rest of the application sees it — no persistence details, no password hash. */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
}

/** Only returned by the dedicated credentials lookup used for sign-in. */
export interface UserCredentials {
  id: string;
  passwordHash: string;
}
