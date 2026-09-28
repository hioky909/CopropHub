# Technology watch

Written in English (RNCP 37873 referential, competencies 2 & 3: documented technology watch,
including some content in English, B1 level). Two notes below, each tied to a real decision made
in this codebase during the pre-production security audit (2026-09-28), not a generic summary.

## 1. CSRF defense for a single-origin SPA: Origin header vs. double-submit token

**Source read**: OWASP Cheat Sheet Series — [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), section "Identifying the Source Origin" and "Employ SameSite Cookie Attribute".

**What it says**: besides the classic synchronizer/double-submit CSRF token, OWASP explicitly lists
verifying the `Origin` header (falling back to `Referer`) as a valid, standalone defense "if you
are able to reliably determine ... the source origin", because modern browsers attach `Origin` on
every cross-site state-changing request (`POST`/`PUT`/`PATCH`/`DELETE`) and it cannot be spoofed
by a malicious page, even through a plain HTML `<form>` submission. The cheat sheet also confirms
`SameSite=Strict` alone remains a strong mitigation, but recommends layering it with another check
when the deployment shape allows it cheaply.

**Why it matches this project, not a generic copy**: CopropHub is a single-origin deployment in
production (Caddy serves the SPA and proxies `/api/*` on the same domain, `deploy/Caddyfile`) —
there is exactly one legitimate `Origin` (`FRONTEND_ORIGIN`), the same value already used for CORS
(`apps/backend/src/app.ts`). A double-submit token would need a new cookie, a new header
convention on every `fetch` call in the frontend, and — critically — would have broken roughly
thirty existing test files that call the API directly through `supertest` without any token
dance. Origin verification reuses a value the backend already trusts, adds one new middleware
(`apps/backend/src/middleware/csrf.middleware.ts`, `exigerOrigineDeConfiance`), and changes zero
existing tests (supertest requests send no `Origin` by default, so they are unaffected; the new
behavior is exercised by dedicated tests instead, `csrf.middleware.test.ts`).

## 2. Sharing rate-limit and revocation state across backend instances: Redis as ephemeral state store, not a data store

**Source read**: Redis documentation — [Using Redis as a session store](https://redis.io/glossary/session-store/) and [express-rate-limit — using a distributed store](https://express-rate-limit.mintlify.app/reference/stores), plus the source of `rate-limit-redis` (official companion package).

**What it says**: Redis' own documentation explicitly discourages using it as the *system of
record* for data that needs durability or relational integrity ("Redis is not meant to replace a
disk-based database ... it is best suited to hold data that is not critical or that can be easily
regenerated"), and recommends `EXPIRE`/`TTL` for exactly this kind of ephemeral, technical state:
sessions, rate-limit counters, caches. `express-rate-limit`'s own docs describe the in-memory
default store as "not suitable for multi-instance deployments" and point to `rate-limit-redis` as
the standard fix.

**Why it matches this project, not a generic copy**: this is precisely the shape of the two
limitations this audit found and fixed — session revocation and rate-limit counters were held in
a `Map` local to one Node process, silently reset on restart and never shared between two backend
instances behind a load balancer. The fix (`apps/backend/src/repositories/redis-client.ts`) keeps
every business record (users, votes, charges, AGs...) exclusively in PostgreSQL — the single
source of truth, per the MCD/MLD/MPD already approved (Doc 3) — and uses Redis **only** for keys
that already had an expiry concept in the code before Redis existed (`session_revoquee:<signature>`
with a TTL equal to the token's remaining lifetime, and rate-limit windows). This is also the
project's first and only use of a NoSQL data store (RNCP referential competency 8), deliberately
scoped to exactly the kind of data Redis' own documentation says it is for.
