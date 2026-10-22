# Project Agent Rules

Central standards apply first. See .standards/README.md for read order and precedence.

Project facts:

- Runtime: Node.js 24 (active LTS), NestJS 11 on Express
- Package manager: pnpm
- Test runner: Jest (unit `*.spec.ts` in `src/`, e2e `*.e2e-spec.ts` in `test/`)
- Deployment target: TBD, single instance (see "Single instance" below)
- Database: none. Immutable extraction snapshots and accumulated JSON resources in `data/`, selected by `current.json`; users load separately at boot. See docs/decisions/0004.
- Cross-cutting directory: `src/common/`
- Logger injection style: `new Logger(ClassName.name)` from `@nestjs/common`, routed through nestjs-pino.
- Client: the Peluffo SPA in `../frontend`, served from the same site (Vite proxy in development).
- Language: code, comments, docs and commits in English. API error messages in English; the frontend owns user-facing copy.

Product rules (decided with the owner; change only with a new decision record):

- Roles that log in: `peluffo`, `colibri`, `fibras`. All three read patients, psychologists and assignments.
- Only `fibras` starts Google Sheets extractions. Capture and interpretation are separate from incremental accumulation; duplicate cedulas are excluded from the current extraction, not deleted from prior accumulated data.
- Extraction compares a persisted A:S content fingerprint. Unchanged calls read and validate but do not write or update resources; full warnings/errors are returned each time. See docs/decisions/0005.
- Only `peluffo` and `fibras` read statistics. Aggregate accumulated processed data, never sum snapshot folders. Age estimates use a preserved observation reference; department derives conservatively from the local INE catalog. Clinical completions and sex stay unavailable until collected. See docs/decisions/0006.
- `data/users.json` is never served. It holds argon2id hashes only; add users with `pnpm hash-password`.
- Google Sheets: read-only through the service account `peluffo-sheets-reader@peluffo-api.iam.gserviceaccount.com`, which sees only sheets shared with it. Its key lives in `secrets/` (git-ignored), never in `data/`.
- Auth: access and refresh JWTs in httpOnly, Secure, SameSite=Strict cookies, never in a response body. See docs/decisions/0001.

Single instance: refresh sessions and rate-limit counters live in process memory. They reset on restart and are not shared. Running more than one instance needs a shared store first.

Departures from the stacks/NESTJS.md reference stack (reason per row):

- ORM (Prisma): not used. The only data write creates immutable extraction snapshots and atomically publishes a reference, on one instance. Add a shared datastore before multi-instance deployment or interactive record writes.
- Auth `bcrypt`: argon2id instead. OWASP's first recommendation; memory-hard as SECURITY.md requires.
- Swagger bearer auth: cookie auth (`addCookieAuth`). Tokens are never readable by client JavaScript.
- Tracing (OpenTelemetry), error tracking (Sentry): not added. No collector or DSN exists yet; add when one does.
- Resilience (`opossum`): not added. Google Sheets reads have a 5 s timeout; extraction is manual, admin-only, single-flight and has no automatic retries. Add a breaker when automated callers are introduced.
- Outbound HTTP (`@nestjs/axios`): `google-auth-library` makes the authenticated Sheets call itself.
- Scheduling, WebSockets: not used.
- Production process (PM2): deferred until a deployment target is chosen.
- Committed `openapi.json` with drift check: deferred; the spec is served at `/docs-json` when `SWAGGER_ENABLED=true`.
- Integration suite (`*.int-spec.ts`): none. Accessor tests use a temporary real filesystem; e2e covers the HTTP boundary.

Git identity (see .standards/standards/GIT.md, "Authorship"):

- user.name: danielfrascarelli
- user.email: dsanfra@gmail.com
- gh account: danielfrascarelli # pull request author, not checked by git hooks

## Applicable standards

- `src/**`, `test/**`, `scripts/**`: NODE, NESTJS
- Root dependency and lock files: DEPENDENCIES
- CI and workflow files: CHECKS, GIT, DELIVERY
- Auth, secrets, external input, crypto, wherever they live: SECURITY

Checks (see .standards/standards/CHECKS.md):

- format: pnpm format:check
- lint: pnpm lint
- typecheck: pnpm typecheck
- test: pnpm test:all
- build: pnpm build
- security: pnpm security
  Runs: pnpm audit --prod --audit-level=high && gitleaks detect --source . --redact

## Overrides

- Replaces stacks/NESTJS.md "Every protected controller MUST carry `@ApiBearerAuth()`".
  Protected controllers carry `@ApiCookieAuth()` instead. Reason: the access token is an httpOnly cookie; there is no bearer header to document.
- Replaces stacks/NESTJS.md "These endpoints MUST exist, version-neutral, with the exposure each one is allowed".
  `/api/health/live` and `/api/health/dependencies` exist; `/health/ready` does not. Reason: there is no datastore; data loads at boot or the process fails to start, so ready would answer exactly what live answers.
- Replaces stacks/NESTJS.md "`npm ci` is the lockfile install this stack MUST use".
  CI installs with `pnpm install --frozen-lockfile`. Reason: the frontend and backend share one package manager, chosen by the owner.
