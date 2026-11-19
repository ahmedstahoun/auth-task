# 0004 — Token strategy

**Status:** accepted

**Context.** The SPA must stay signed in across reloads without exposing long-lived credentials to JavaScript.

**Decision.**

- Access token: JWT, 15 min, returned in the response body, kept **in memory** by the client, sent as Bearer.
- Refresh token: JWT, absolute 7-day session lifetime, httpOnly cookie, `SameSite=Strict`, `Path=/auth`,
  `Secure` + `__Secure-` prefix in production. Rotated on every use with reuse detection.
- Separate secrets, a `typ` claim, pinned HS256, verified `iss`/`aud`; claims parsed with zod.
- Every protected request also verifies the session exists, making revocation immediate.

**Consequences.**

- XSS cannot read either token from storage; CSRF is blocked by SameSite + Origin check + Bearer requirement.
- A page reload costs one `/auth/refresh` call (silent sign-in).
- The client must serialise refreshes (shared in-flight promise) to avoid false reuse detection.
- HS256 is fine with a single verifier; switch to RS256 + JWKS if other services verify tokens.
