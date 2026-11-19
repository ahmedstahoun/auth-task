# 0002 — Mongoose instead of TypeORM

**Status:** accepted

**Context.** MongoDB is mandatory. TypeORM was the initial preference, but its MongoDB driver is second-class
(limited query builder and relations, awkward `ObjectId` handling, `MongoRepository` quirks).

**Decision.** Use Mongoose via `@nestjs/mongoose`, with schemas typed through `InferSchemaType`.

**Consequences.**

- First-class MongoDB features used directly: TTL indexes, update pipelines, `sanitizeFilter`, `trusted()`.
- Types are inferred from the schema definitions instead of duplicated in entity classes.
- Data access is isolated in `UsersService` and the `SessionStore` implementation, so the ODM is replaceable.
