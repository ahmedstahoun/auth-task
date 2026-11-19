# 0006 — Repository layer behind interfaces

**Status:** accepted

**Context.** Services originally injected Mongoose models (users) and a session-store abstraction living
inside a feature folder. That coupled business logic to the ODM, made `UsersService` testable only against a
real database, and mixed types, schemas and implementations in the same files.

**Decision.**

- A dedicated `RepositoriesModule` registers all Mongoose models and exports **only** repository interfaces,
  bound to injection tokens (`USERS_REPOSITORY`, `SESSIONS_REPOSITORY`, `LOGIN_ATTEMPTS_REPOSITORY`).
- Repositories return domain models (`repositories/models`), never Mongoose documents, and translate driver
  errors into domain errors (`DuplicateEmailError`).
- Interfaces, models and schemas live in their own files and folders; `DatabaseModule` owns the connection.
- An `app.wiring.spec.ts` compiles the real modules against a disconnected connection to catch DI mistakes
  without a database.

**Consequences.**

- Services are unit-tested against typed repository mocks; Mongo implementations are integration-tested.
- Replacing a store (e.g. sessions → Redis) is one new class and one `useClass` change.
- Slightly more files and an explicit `@Inject(TOKEN)` per repository dependency.
