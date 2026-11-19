# How I used AI on this task

## Tooling

- **Claude (chat)** for planning: reading the brief, choosing the architecture, and turning the decisions into a spec.
- **Claude (coding agent)** for implementation, driven by that spec ([`CLAUDE.md`](CLAUDE.md), committed in this repo).

## How I worked

I treated the AI as a fast implementer and kept the decisions and the quality bar with me:

1. **Planning first (chat).** I fed in the brief and my stack preferences (React, NestJS, shadcn/ui, JWT), then pushed
   the plan in specific directions: strict type safety with no `any`, a hardened security posture, and server-side
   session state that doesn't live in memory.
2. **Spec as the prompt.** Everything we agreed went into `CLAUDE.md`: requirements, non-negotiable rules
   (type safety, security), architecture decisions with reasons, a phased plan with "done when" criteria, and a
   self-review checklist. Coding prompts could then be one line ("start Phase N") and still be precise.
3. **Verification built into the workflow.** The agent had to run typecheck, lint and tests after every phase and
   show the real output before committing. Most of the corrections below were caught this way.
4. **Running it myself, then reviewing the code.** I ran the app locally on Windows against MongoDB, which surfaced
   two environment bugs, and reviewed the API structure, which led to a refactor (below).
5. **AI.md last, and only on my command.** The agent kept a raw log (`docs/ai-log.md`) after each phase and wasn't
   allowed to write this file until I asked for it.

## Where AI helped (by area)

| Area                  | AI contribution                                                                            | My role                                                         |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Architecture & plan   | Proposed the stack details, token strategy, phase plan                                     | Chose and constrained them (see "Decisions I made differently") |
| Monorepo, tooling, CI | Generated the workspace, strict TS/ESLint config, GitHub Actions, Dockerfile               | Set the strictness bar; reviewed                                |
| API (NestJS)          | Generated the modules, services, guards, logging, error handling; executed the restructure | Specified the security model; asked for the repository layer    |
| Tests                 | Generated the test utilities, 126 API unit tests, integration/e2e suites, 36 web tests     | Defined required cases and coverage gates                       |
| Web (React)           | Generated the client, auth state, pages, shadcn components                                 | Defined UX requirements (live checklist, error mapping)         |
| Docs                  | Drafted the README (incl. screenshots), SECURITY.md, ADRs                                  | Reviewed                                                        |

## Prompts and approaches that worked well

- **A spec file instead of long prompts.** Putting the rules in `CLAUDE.md` ("no `any`, no `as`, untrusted data is
  `unknown`", "never claim tests pass without running them", "stop and tell me instead of escaping with any/as")
  kept the agent consistent across phases. Without that last rule, agents tend to quietly add `as any` when stuck.
- **Asking for the simpler option.** "is there something more simple than redis?" led to sessions in MongoDB
  with TTL indexes behind a swappable interface: same security properties, one less service.
- **Asking pointed review questions.** "is there a sanitization level in the backend (request, db) to secure from
  sql injection and so on" got a layer-by-layer walkthrough of the defences and one new rule (below).
- **Code-review feedback as a prompt.** "interface and models are not in separate files please separate them in
  another folder … i want a separate module for the repository, follow the best structure practices" produced the
  repository layer in one pass, with every import rewritten by a script and the full test suite re-run.
- **Making it verify against reality.** Requiring real command output, rather than a summary, surfaced the bugs below.
- **Phase gates with "done when" criteria** kept scope tight and gave the history one commit per phase.

## What was corrected or reworked

| Issue                                                                                                                                                                                                                                      | How it surfaced                            | Fix                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Secrets could have been logged.** pino's `*.password` only matches nested keys, so a top-level `password`/`accessToken` would have been logged in clear text. The original test only checked the config list.                            | Self-review: logging through real pino     | Added top-level paths; replaced the test with one that asserts on real log output, and confirmed it fails on the old config |
| **Dependency injection would have broken at runtime.** Config was typed with a type alias, which compiles to `Object` in decorator metadata. The first version also used a `config as AppConfig` cast, breaking our own no-assertion rule. | Typecheck / review                         | Replaced with a small injectable `AppConfig` class (also easier to mock)                                                    |
| **API couldn't reach MongoDB on Windows.** `localhost` resolved to IPv6 `::1` first, while MongoDB listened on IPv4 only (`ECONNREFUSED`).                                                                                                 | Running it locally                         | All connection strings use `127.0.0.1`                                                                                      |
| **API looked frozen when the database was down.** Boot logs were buffered, so Mongoose's connection retries were invisible.                                                                                                                | Running it locally                         | Boot logs unbuffered; retries now show immediately                                                                          |
| **Services coupled to the database layer.** `UsersService` injected a Mongoose model (testable only against a real DB), and types, schemas and implementations shared files.                                                               | My code review                             | Repository layer + one-concern-per-file structure (see "Decisions I made differently")                                      |
| **Wrong audit data.** The sign-in audit event logged the refresh token's jti as the session id.                                                                                                                                            | Re-read during the build                   | Fixed; covered by unit test                                                                                                 |
| **Misleading coverage.** Branch coverage read ~41% because SWC's decorator helpers were counted as branches.                                                                                                                               | Coverage report                            | Switched Jest to the v8 provider: 99.9% lines / 96% branches, real numbers                                                  |
| **Version assumptions.** NestJS 12 is ESM-only and `nestjs-zod`/Jest support lags; TypeScript 7 isn't supported by typescript-eslint.                                                                                                      | Checked package metadata before installing | Pinned NestJS 11 and TS 6.0; wrote a ~20-line typed zod pipe                                                                |
| **Type mismatch with Swagger.** Zod's JSON Schema isn't assignable to Swagger's `SchemaObject`.                                                                                                                                            | Typecheck                                  | A small typed converter instead of a cast                                                                                   |
| **Over-strict validation.** A new "no control characters in names" rule first used `\p{Cf}`, which would reject Persian names containing a zero-width non-joiner.                                                                          | Review                                     | Narrowed to control characters + bidi overrides; added an international-names test                                          |
| **Test helpers leaking `any`.** Jest asymmetric matchers and untyped `jest.fn()`.                                                                                                                                                          | Lint                                       | Rewritten with typed mocks                                                                                                  |
| **Windows / dev-experience issues.** A POSIX-only npm script; tsup cleaning `dist` in watch mode while dev servers read it.                                                                                                                | Review                                     | Removed / fixed                                                                                                             |

## Decisions I made differently from what AI suggested

- **Redis.** The AI proposed Redis for sessions, the denylist and rate limits. I pushed back: a second datastore is
  unnecessary infrastructure for this scope (I've run Redis in production for an SMS module, so the trade-off is
  familiar). We settled on MongoDB TTL indexes behind a swappable interface, with two conditions: never rely on TTL
  timing alone (every read checks `expiresAt`), and rotate refresh tokens with a single atomic update.
- **Repository layer.** The first version had services injecting Mongoose models directly and types living inside
  implementation files. After reviewing it I asked for a dedicated `RepositoriesModule`: repository interfaces bound
  to injection tokens, domain models separate from Mongoose schemas, and every interface in its own file. Services
  now never import Mongoose, `UsersService` is unit-tested against a mocked repository, and a wiring test catches
  DI mistakes without a database (proved by removing an `@Inject` token and watching it fail). See ADR 0006.
- **Seniority of the solution.** The first plan was pitched at mid-level. I raised it: ADRs, a threat model in
  SECURITY.md, coverage gates, and a stricter review step.
- **Type safety as a first-class requirement.** I made "no `any` / no assertions / parse untrusted data" a
  non-negotiable rule enforced by lint and CI, not a guideline.
- **Simplifications accepted during the build** (proposed while implementing; I agreed):
  - No Passport: one strategy, so a small typed guard is clearer.
  - No separate access-token denylist: the guard checks the session on every request, so revocation is
    already immediate.
  - Absolute session lifetime: refresh tokens don't extend the session.

## What I verified myself

- Ran the full app locally on Windows (Node, pnpm, MongoDB): sign-up with validation, sign-in, the protected
  welcome page, log out and log out everywhere all work as expected.
- The integration and e2e suites run against a real MongoDB in CI on every push.

## Time

| Phase                                                              | Time                                 |
| ------------------------------------------------------------------ | ------------------------------------ |
| Planning & spec (chat)                                             | ~1.5 h                               |
| Implementation, phases 1–9 (agent, with verification at each step) | ~35 min (22:00–22:35, see `git log`) |
| Local setup, manual testing, code review & repository refactor     | ~1 h (22:50–23:40)                   |
| Final review of this document                                      | ~5 min (23:40–23:45)                 |
