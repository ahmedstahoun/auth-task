# Security

## Threat model

| Threat                                   | Mitigation                                                                                                                                                                               | Where                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Password database leak                   | argon2id (19 MiB, t=2, p=1 — OWASP baseline), unique salt per hash; hashes never selected by default nor returned                                                                        | `auth/password.service.ts`, `users/user.schema.ts`, `users/user.mapper.ts`      |
| Credential stuffing / brute force        | Per-IP throttle on sign-in/sign-up (default 5/min) + per-email lockout after 5 failures for 15 min, persisted in MongoDB                                                                 | `auth/rate-limit.ts`, `auth/auth.service.ts`, `sessions/mongo-session.store.ts` |
| Account enumeration via sign-in          | Same 401 body for unknown email and wrong password; a dummy argon2 verification equalises timing                                                                                         | `auth/auth.service.ts`, `auth/password.service.ts`                              |
| Hashing DoS (very long passwords)        | Max 128 characters, enforced by schema and again in the hasher                                                                                                                           | `@auth/shared`, `password.service.ts`                                           |
| XSS stealing tokens                      | Access token only in memory; refresh token in an httpOnly cookie; strict CSP in the production build; React escaping, no `dangerouslySetInnerHTML`                                       | `web/src/lib/api/token-store.ts`, `web/vite.config.ts`                          |
| CSRF on cookie-authenticated endpoints   | Cookie `SameSite=Strict` + `Path=/auth`; `/auth/refresh` and `/auth/logout` also require an allow-listed `Origin` header; all other endpoints need a Bearer header                       | `auth/refresh-cookie.ts`, `common/http/origin.guard.ts`                         |
| Stolen refresh token                     | Rotation on every use; the session stores only a SHA-256 of the current jti; presenting an old jti revokes **all** sessions of the user and emits an audit warning                       | `sessions/mongo-session.store.ts`, `auth/auth.service.ts`                       |
| Refresh race (two tabs / StrictMode)     | Rotation is a single atomic conditional update; the web client shares one in-flight refresh                                                                                              | `mongo-session.store.ts`, `web/src/lib/api/client.ts`                           |
| Token forgery / confusion                | Separate access/refresh secrets (≥32 chars, must differ), HS256 pinned (no `none`), `iss`/`aud` verified, `typ` claim, payload parsed with zod                                           | `tokens/token.service.ts`, `config/env.schema.ts`                               |
| Revocation latency of JWTs               | Every authenticated request checks the session still exists, so logout/theft response is immediate                                                                                       | `auth/jwt-auth.guard.ts`                                                        |
| NoSQL injection / mass assignment        | `.strict()` zod schemas reject unknown keys and non-string values; Mongoose `sanitizeFilter` + `strictQuery`; own operators explicitly `trusted()`; `strict: 'throw'` on the user schema | `@auth/shared`, `common/mongo/mongo.config.ts`                                  |
| Information leakage                      | Single error shape; 5xx messages replaced in production; stack traces only in server logs                                                                                                | `common/http/all-exceptions.filter.ts`                                          |
| Secrets in logs                          | pino redaction of authorization, cookies, set-cookie, password/token fields; minimal request serializer; emails masked in audit logs                                                     | `common/logging/*`                                                              |
| Misconfiguration                         | Env validated at boot (fail fast, no default secrets)                                                                                                                                    | `config/env.schema.ts`                                                          |
| Large payloads                           | JSON-only body parser with a 10 kB limit                                                                                                                                                 | `bootstrap.ts`                                                                  |
| Clickjacking, MIME sniffing, etc.        | helmet defaults (HSTS, nosniff, frame-ancestors, …); `x-powered-by` disabled                                                                                                             | `bootstrap.ts`                                                                  |
| Cross-origin abuse                       | CORS allow-list from env with credentials; never `*`                                                                                                                                     | `bootstrap.ts`                                                                  |
| Vulnerable dependencies / leaked secrets | `pnpm audit` (high), CodeQL, Dependabot, gitleaks in CI                                                                                                                                  | `.github/`                                                                      |

## Known limitations

- **Sign-up returns 409 for an existing email**, which reveals that the account exists. Rate limiting reduces the
  impact; the full fix is an email-verification flow that always answers "check your inbox".
- **Per-email lockout can be triggered by an attacker** to temporarily block a victim (15 min window). Alternatives
  (progressive delays, CAPTCHA after N failures) are noted as next steps.
- **Throttler counters are in memory**, per API instance. Behind a load balancer they should move to a shared store.
- **TTL deletion is asynchronous** (MongoDB checks roughly every 60 s). All reads also filter `expiresAt > now`, so
  expired sessions are never honoured.
- `TRUST_PROXY` must be set correctly behind a reverse proxy, otherwise rate limits key on the proxy IP.

## Reporting

Please report vulnerabilities privately to the repository owner rather than opening a public issue.
