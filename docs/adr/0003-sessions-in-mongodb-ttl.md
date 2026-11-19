# 0003 — Server-side sessions in MongoDB (TTL) rather than Redis

**Status:** accepted

**Context.** Refresh-token rotation, reuse detection, immediate logout and a persistent lockout counter all need
server-side state with expiry. Redis is the usual choice (and one I've run in production), but it adds a second
datastore to run, secure and test.

**Decision.** Store sessions and login-attempt counters in MongoDB collections with TTL indexes, behind a
`SessionStore` abstract class. Reads also filter `expiresAt > now` because the TTL monitor runs about every 60 s.
Rotation is a single atomic `findOneAndUpdate` conditioned on the current jti hash.

**Consequences.**

- No extra infrastructure; e2e tests need only MongoDB.
- One indexed lookup per authenticated request (session check) — fine at this scale.
- For high traffic or multi-region, add a `RedisSessionStore` implementation; auth logic does not change.
- A separate access-token denylist is unnecessary: deleting the session already invalidates its access tokens.
