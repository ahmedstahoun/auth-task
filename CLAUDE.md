# CLAUDE.md — Project instructions for the AI coding agent

You are helping a **senior full-stack engineer / team lead** complete a take-home task.
The author makes the decisions; you execute, verify, and report honestly.
Follow this file for the whole session. If anything here conflicts with a request, ask.

---

## 1. The task (from the hiring company)

Build a production-ready auth module:
- **Sign up**: email (valid format), name (min 3 chars), password (min 8, ≥1 letter, ≥1 number, ≥1 special char)
- **Sign in**: email, password
- **App page**: shows exactly `Welcome to the application.` + logout button
- **Backend**: NestJS + MongoDB, at least one protected endpoint, README
- **Frontend**: React + TypeScript
- **Required**: `AI.md` describing AI usage — prompts that worked, what was corrected, decisions made differently from AI
- **Scored on**: functionality, production-readiness (security, maintainability), code quality, delivery speed (a few hours)
- **Bonus**: logging, error handling, testing, CI/CD, API docs

Speed is scored. Do not gold-plate. Anything beyond this file goes in README "Next steps".

---

## 2. Hard rules (always apply)

### Workflow
1. Work **phase by phase** (section 5). Before writing code for a phase, give a plan of 5 lines or fewer and **wait for my OK**.
2. After each phase: run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and show me the real output. Never claim something passes without running it.
3. When a phase is green, propose a Conventional Commit message (`feat(api): ...`, `chore: ...`, `test(web): ...`). Commit only after I approve it. **Never push.**
4. Verify library versions and APIs against what's actually installed (read the package's types and docs in node_modules). Don't rely on memory for APIs that change between versions.
5. If you get stuck, can't type something cleanly, or want to deviate from this file, **stop and tell me**. Don't work around it silently.

### Type safety (non-negotiable)
- No `any`, explicit or implicit. No `as any`, no `@ts-ignore`. `@ts-expect-error` only with a written reason.
- Avoid `as` assertions. Use type guards, zod parsing, or `satisfies` instead. Tests may use assertions.
- Untrusted data is `unknown` and gets narrowed: catch variables, `JSON.parse`, HTTP responses, `process.env`, `import.meta.env`.
- Types are **derived, not duplicated**: `z.infer` from shared schemas, `InferSchemaType`/`HydratedDocument` for Mongoose.
- Exported functions have explicit return types.
- No `!` non-null assertions in app code.

### Security (non-negotiable)
- No default or fallback secrets anywhere. Env is validated at boot and the app fails fast.
- Never return `passwordHash` or any token hash in a response.
- Sign-in failures always return an identical `401 Invalid credentials`, whether the email is unknown or the password is wrong, with equalized timing.
- Never log passwords, tokens, cookies, or authorization headers.

### AI.md (special rule)
- Keep a running log in `docs/ai-log.md` (section 6). Append to it **after every phase**.
- **Do not create, write, or commit `AI.md` until I explicitly say "write the AI.md draft".**
- When I do: write it from `docs/ai-log.md` + `git log` only. **Never invent** prompts, corrections, or timings. Put a `> DRAFT — pending author review` banner at the top, **do not commit it**, and wait for my edits.
- Do not commit `docs/ai-log.md` either. I'll decide at the end.

---

## 3. Architecture decisions (already made — don't relitigate)

| Area | Decision | Why (short) |
|---|---|---|
| Repo | pnpm workspaces monorepo: `apps/api`, `apps/web`, `packages/shared` | One link to submit; shared schemas/types; atomic changes; one CI |
| DB access | **Mongoose** (`@nestjs/mongoose`), not TypeORM | TypeORM's Mongo support is second-class |
| Validation | **zod** in `packages/shared`, used by web forms AND API DTOs | One source of truth for rules + types |
| API validation | `nestjs-zod` if compatible with the installed zod version, else a small typed `ZodValidationPipe`. Global. | Avoids class-validator duplication |
| Passwords | argon2id, explicit params, max 128 chars | Modern KDF; prevents hashing DoS |
| Access token | JWT, 15m, returned in body, kept **in memory only** on the frontend | Not readable by XSS-injected storage reads |
| Refresh token | JWT, 7d, httpOnly cookie, Path=/auth, SameSite=Strict, Secure in prod (`__Secure-` prefix in prod) | Standard, CSRF-resistant |
| Sessions | **MongoDB `sessions` collection with TTL index** (no Redis) | No extra infra for a take-home; behind a `SessionStore` interface so Redis can be swapped in |
| Rotation | Refresh rotates every time; **reuse detection** revokes all of the user's sessions | Detects stolen refresh tokens |
| Rate limit | `@nestjs/throttler` with in-memory storage (documented trade-off) + per-email lockout persisted in Mongo | Lockout survives restarts; throttler storage is swappable |
| Logging | `nestjs-pino` (pino-http): JSON in prod, `pino-pretty` in dev, request IDs, redaction, audit logger (see 4.1) | Structured, fast, production-grade |
| Docs | Swagger at `/docs`; `/health` via `@nestjs/terminus` | Bonus points |
| Frontend | Vite, React Router, TanStack Query, react-hook-form + zodResolver, shadcn/ui, sonner, axios | |
| Tests | API: Jest (`@swc/jest`) + `@nestjs/testing` + a shared `test/` utilities module; e2e with supertest + mongodb-memory-server. Web/shared: Vitest + RTL + MSW. Coverage gates in CI (see 4.2) | Fast, isolated unit tests |
| CI | GitHub Actions: install (cached) → lint → typecheck → unit tests with coverage gate → e2e → build; upload coverage report as an artifact; `pnpm audit`, CodeQL, Dependabot, gitleaks | |

---

## 4. Technical specification

### Shared (`packages/shared`)
- `signUpSchema`, `signInSchema` (`.strict()`, email `trim().toLowerCase()`).
- Password regex: `^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$`. Also export the individual rules so the UI checklist can reuse them.
- Contract types: `UserDto`, `AuthResponse { accessToken, user }`, `ApiError { statusCode, message, error, path, timestamp, requestId }`, and an `isApiError` type guard.

### API (`apps/api`)
- **Env** (zod): `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_ACCESS_SECRET` (≥32), `JWT_REFRESH_SECRET` (≥32, different from access), `JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGIN`, `TRUST_PROXY`. Use `ConfigService<Env, true>` with `{ infer: true }`.
- **Bootstrap**: helmet, `x-powered-by` off, body limit 10kb, cookie-parser, CORS with an explicit origin and credentials (never `*`), global zod pipe, global exception filter, pino, Swagger, graceful shutdown hooks.
- **Mongoose**: `strictQuery: true`, `sanitizeFilter: true`.
- **User schema**: email (unique, lowercase), name, passwordHash (`select: false`), timestamps. Controllers return DTOs via `toUserDto()` and never return documents.
- **SessionStore** (interface + Mongo implementation; the only place that touches these models):
  - `sessions { userId(idx), jtiHash, familyId, userAgent, ip, createdAt, expiresAt(TTL) }`
  - `revoked_tokens { jti(unique), expiresAt(TTL) }`
  - `login_attempts { email(unique), count, expiresAt(TTL) }`
  - Every read also filters `expiresAt > now`, because the TTL monitor only runs about every 60s.
  - `rotateSession` is ONE atomic `findOneAndUpdate` conditioned on the old `jtiHash`. No match means reuse, so call `revokeAllForUser`.
  - Store SHA-256 of the jti, never the raw token. Compare with a timing-safe check.
- **JWT**: HS256 pinned, `iss`/`aud` set and verified, claims `sub`, `sid`, `jti`. The strategy rejects a token when its session is gone or its jti is revoked. Typed `JwtPayload`, `AuthUser`, and a `@CurrentUser()` decorator. No `req.user as any`; use module augmentation if needed.
- **Endpoints**:
  - `POST /auth/signup` → 201 `AuthResponse` + refresh cookie; 409 on duplicate email
  - `POST /auth/signin` → 200 `AuthResponse` + cookie; 401 generic; 429 when throttled or locked out
  - `POST /auth/refresh` → rotates; validates the `Origin` header
  - `POST /auth/logout` → revokes the session + denylists the access jti; clears the cookie
  - `POST /auth/logout-all`, `GET /auth/sessions` (protected)
  - `GET /users/me` (protected)
  - `GET /health`
- **Brute force**: throttle signin/signup per IP (e.g. 5/min). Per-email lockout after 5 failures for 15m, with a generic message. Verify against a dummy argon2 hash when the user doesn't exist (timing).
- **Errors**: one consistent `ApiError` shape. No stack traces or internal messages in prod; log them with the request id. Detect the Mongo duplicate key (11000) with a type guard.
- **Audit logs**: `signup`, `signin_success`, `signin_failed`, `lockout`, `refresh_reuse_detected`, `logout`, `logout_all`.
- **Dockerfile**: multi-stage, non-root, `NODE_ENV=production`.

### 4.1 Logging (`apps/api`, nestjs-pino)
- `LoggerModule.forRootAsync` built from the typed `ConfigService`. `app.useLogger(app.get(Logger))` with `bufferLogs: true`, so Nest's own boot logs go through pino too.
- **Levels**: `LOG_LEVEL` env (zod enum: fatal|error|warn|info|debug|trace). Default `info` in prod, `debug` in dev, `silent` in tests.
- **Format**: JSON in prod. `pino-pretty` transport only when `NODE_ENV=development` (it's a dev dependency).
- **Request ID**: `genReqId` reuses an incoming `x-request-id` if it's a valid UUID, otherwise generates one with `randomUUID()`. It's echoed back in the `x-request-id` response header and included in every `ApiError`.
- **Context**: `customProps` adds `userId` when authenticated. Serializers keep only `method`, `url`, `statusCode`, `responseTime`, `remoteAddress`, and `userAgent`.
- **Redaction** (`censor: '[REDACTED]'`): `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `*.password`, `*.passwordHash`, `*.accessToken`, `*.refreshToken`, `*.token`.
- **Noise control**: `autoLogging.ignore` for `/health`. `customLogLevel`: 5xx → error, 4xx → warn, else info.
- **Services** use an injected `PinoLogger` (`@InjectPinoLogger(ClassName.name)`), never `console.*`. ESLint `no-console: error` in apps/api.
- **AuditLogger**: a small typed service with a closed union of event names (the audit events listed above) and a typed payload per event (`userId`, `email` hashed or partially masked, `ip`, `sessionId`). It logs at `info` with `{ audit: true }` so the events can be filtered.
- **Exception filter**: logs 5xx with the stack and request id at `error`, and 4xx at `warn` without the stack. Clients never see internals.
- **Graceful shutdown**: `enableShutdownHooks()`; flush the logger on exit.

### 4.2 Unit testing module (`apps/api/test/`)
Structure:
```
apps/api/
  src/**/*.spec.ts          # unit tests live next to the code
  test/
    utils/
      factories.ts          # typed builders: buildUser(), buildSession(), buildSignUpInput() (overrides: Partial<T>)
      mocks.ts              # typed mocks: mockSessionStore(), mockUserModel(), mockConfig(env), mockPinoLogger(), mockAuditLogger()
      testing-module.ts     # createTestingModule({ providers, overrides }) helper wrapping @nestjs/testing
      jwt.ts                # signTestToken() helpers with test secrets
    e2e/
      setup.ts              # mongodb-memory-server lifecycle, app bootstrap identical to main.ts
      auth.e2e-spec.ts
      security.e2e-spec.ts
  jest.config.ts            # unit project
  jest.e2e.config.ts        # e2e project
```
Rules:
- Mocks are typed with `jest.Mocked<T>` / `DeepMocked` (`@golevelup/ts-jest`) against the real interfaces. No `any` and no untyped `{}` casts, even in tests.
- Unit tests touch no network, DB, or real clock. Use `jest.useFakeTimers()` for expiry logic. Each test is independent (`beforeEach` rebuilds the module).
- Arrange / Act / Assert, with behaviour-based names: `it('returns 401 with a generic message when the password is wrong')`.
- `@swc/jest` for speed. `test` runs unit tests only, `test:e2e` runs e2e, `test:cov` produces coverage.
- **Coverage gate** (unit): global ≥ 80% lines and branches; `src/auth/**` and `src/sessions/**` ≥ 90%. CI fails below that. Exclude `main.ts`, `*.module.ts`, DTOs, and schemas.

Required unit tests:
- `packages/shared`: each password rule fails on its own; email normalization; `.strict()` rejects unknown keys; `isApiError`.
- `PasswordService`: hash/verify round-trip; rejects > 128 chars; the dummy-hash verify path runs when the user is missing.
- `TokenService`: claims (`sub`, `sid`, `jti`, `iss`, `aud`); rejects a token with a wrong secret, issuer, or audience, or an expired one.
- `AuthService`: signup success and duplicate (409); signin success, wrong password, unknown email (same error); lockout after N failures; refresh rotates; **refresh reuse → `revokeAllForUser` called**; logout revokes the session and denylists the jti; audit events emitted with the right names.
- `SessionStore` (Mongo implementation, using mongodb-memory-server, labelled as an integration test): atomic rotation, the reuse path, expired sessions are ignored even before the TTL monitor deletes them.
- `JwtStrategy`: rejects when the session is gone or the jti is revoked.
- `AllExceptionsFilter`: shape, no stack in prod, 11000 → 409, correct log level.
- Config schema: boot fails on missing or short secrets, or identical access and refresh secrets.

### Web (`apps/web`)
- Env via zod (`VITE_API_URL`), typed `vite-env.d.ts`.
- API client: axios with `withCredentials`, the access token in a module-scoped variable (never in storage), and a 401 interceptor that does ONE shared in-flight refresh (mutex), queues concurrent requests, never loops on `/auth/refresh`, and validates responses with zod.
- `AuthProvider`: silent refresh on load, then a proactive refresh before expiry. `ProtectedRoute`, `PublicOnlyRoute`.
- Routes: `/signin`, `/signup`, `/app` (redirect `/` appropriately).
- Forms: `useForm<SignUpInput>` + `zodResolver` with the shared schemas. Live password checklist, show/hide toggle, pending state on submit, 409 shown on the email field, 401 shown as a form error, 429 shown as "Too many attempts", toasts for unexpected errors.
- `/app`: a Card with `Welcome to the application.`, the user's name from `/users/me`, and Logout.
- Accessible (labels, `aria-invalid`, `aria-describedby`), responsive, dark-mode ready, clean centered-card design.
- Query keys come from a typed const factory.

### Tooling
- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (drop only if it truly breaks Nest/Swagger decorators, and log that in ai-log), `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `forceConsistentCasingInFileNames`.
- ESLint flat config with typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (type-aware). Set to error: `no-explicit-any`, all `no-unsafe-*`, `ban-ts-comment` (allow ts-expect-error with a description), `consistent-type-assertions` (never, except tests), `explicit-module-boundary-types`, `no-floating-promises`, `switch-exhaustiveness-check`, `consistent-type-imports`, `no-non-null-assertion`, `no-console` (apps/api).
- Root scripts: `dev`, `build`, `typecheck`, `lint` (`--max-warnings 0`), `test`, `test:e2e`, `format`.
- Prettier, `.editorconfig`, `.nvmrc`, `.env.example` per app.

---

## 5. Phases (time-boxed, about 5h total)

| # | Phase | Done when | Box |
|---|---|---|---|
| 1 | Monorepo + tooling + shared schemas + schema tests + docker-compose (Mongo) | typecheck/lint/test green from root | 30m |
| 2 | API foundation: env, bootstrap, **logging (4.1)**, exception filter, Mongoose, Users, Swagger, health, **test utilities module + Jest configs (4.2)** | `/health` and `/docs` work; request id visible in logs and response header; one sample unit test passes using the helpers | 50m |
| 3 | SessionStore + Auth (all endpoints, rotation, reuse detection, lockout, throttling, AuditLogger) | manual curl flow works; audit events appear in logs; secrets redacted | 60m |
| 4 | API tests: all required unit tests (4.2) + e2e incl. security cases (below) | all green; coverage gates met (show the report summary) | 50m |
| 5 | Web foundation: Vite, shadcn, router, query, API client + interceptor, AuthProvider, guards | app boots, guards redirect | 40m |
| 6 | Pages: sign up, sign in, app page, polish, a11y | full flow works in browser | 40m |
| 7 | Web tests (Vitest + RTL + MSW) | green | 25m |
| 8 | CI, Dockerfile, README, SECURITY.md, ADRs | CI config valid | 30m |
| 9 | Self-review (section 7) + fixes | issues list resolved or justified | 20m |
| 10 | AI.md **draft only**, on my command | draft in working tree, uncommitted | 10m |

**Security e2e cases (phase 4)**: refresh reuse revokes all sessions · logged-out access token rejected immediately · lockout after N failures · 429 on throttle · unknown email and wrong password give identical status and body · `{"email":{"$gt":""}}` → 400 · no response ever contains `passwordHash` · refresh with a bad `Origin` → 403 · missing or invalid bearer → 401.

### Phase 8 docs
- **README**: overview, mermaid architecture diagram, quick start (`docker compose up -d`, copy `.env.example`, `pnpm i`, `pnpm dev`), scripts, endpoints table, auth flow diagram (sequence), type-safety section, security summary, testing, trade-offs, next steps (email verification, password reset, 2FA, RS256 + key rotation, Redis-backed SessionStore/throttler for horizontal scale, Turborepo).
- **SECURITY.md**: threat → mitigation → file location table, plus known limitations.
- **docs/adr/**: one short ADR (Context / Decision / Consequences, 15 lines or fewer) per item: 0001 monorepo, 0002 Mongoose over TypeORM, 0003 sessions in Mongo TTL vs Redis, 0004 token strategy (memory access + httpOnly refresh + rotation), 0005 zod as single source of truth.

---

## 6. `docs/ai-log.md` format (append after every phase)

```
## Phase N — <name>  (start–end time, from git timestamps if possible)
**Prompt I gave:** <verbatim>
**What AI generated:** <1–3 lines>
**Issues found / corrections:** <concrete: what was wrong, how it was fixed, who caught it>
**AI suggestions rejected or changed by the author:** <and why>
**Verification:** <commands run + result>
```

Be honest about your own mistakes. Log every time you reached for `any`, `as`, a fallback secret, a non-generic auth error, or a missing TTL, and how it was fixed. Before closing each phase, ask me: *"Anything you changed or rejected in this phase that I should log?"*

---

## 7. Self-review checklist (phase 9)

Act as a strict senior reviewer at the hiring company. Check against the task and scoring, then report by severity. Don't fix anything until I approve.
- Requirements: every field rule enforced on BOTH sides; exact welcome text; protected endpoint; README; logout.
- Type safety: `grep -rnE "\bany\b|as unknown as|@ts-|[a-zA-Z)\]]!\.|[a-zA-Z)\]]!\)" apps packages --include=*.ts --include=*.tsx`. Justify or fix each hit. Look for untyped `response.data` and `JSON.parse`.
- Security: secrets, CORS, cookie flags, enumeration, timing, TTLs, reuse detection, log redaction, no hashes in responses, sanitizeFilter, body limit.
- Logging: no `console.*`; every request has a request id; trigger signin with a password and confirm the logs show `[REDACTED]`; `/health` isn't logged; audit events present.
- Tests: coverage gates met; no test hits the network or depends on order; mocks are typed (no `any`).
- Quality: module boundaries, dead code, naming, consistent error shape, no TODOs left.
- DX: fresh clone → README steps work exactly as written.
