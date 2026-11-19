# 0001 — pnpm workspaces monorepo

**Status:** accepted

**Context.** The task asks for one public repository containing a React front end and a NestJS back end whose
validation rules must match.

**Decision.** A pnpm workspaces monorepo: `apps/api`, `apps/web`, `packages/shared`. No Turborepo/Nx.

**Consequences.**

- One clone, one README, one CI pipeline; front end and back end change atomically.
- `@auth/shared` lets both apps import the same zod schemas and contract types.
- Small tooling cost (workspace config, building `shared` first). Turborepo is the next step if builds grow.
