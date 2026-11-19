# 0005 — zod schemas as the single source of truth

**Status:** accepted

**Context.** Field rules (email, name ≥ 3, password policy) must be identical in the UI and the API, and the API
docs should not drift from validation.

**Decision.** Define schemas once in `@auth/shared` with zod. The web uses them with `zodResolver`; the API uses a
typed `ZodValidationPipe`; Swagger request/response docs are generated from the same schemas; TypeScript types
are `z.infer`-ed. `nestjs-zod` was considered but does not support the NestJS version in use, so the pipe and the
OpenAPI bridge are small local utilities.

**Consequences.**

- Changing a rule is a one-line change that both apps and the docs pick up, enforced by the type checker.
- Validation errors have the same messages on both sides.
- API responses are also parsed on the client, so contract drift fails loudly instead of silently.
