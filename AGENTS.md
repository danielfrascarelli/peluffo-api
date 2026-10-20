# Project Agent Rules

Central standards apply first. See .standards/README.md for read order and precedence.

Project facts:

- Runtime: Node.js 24 (active LTS), NestJS 11 on Express
- Package manager: npm
- Test runner: Jest (unit `*.spec.ts` in `src/`, e2e `*.e2e-spec.ts` in `test/`)
- Deployment target: TBD, single instance (see "Single instance" below)
- Database: none. Read-only JSON files in `data/`, loaded at boot. See docs/decisions/0001.
- Cross-cutting directory: `src/common/`
- Logger injection style: `new Logger(ClassName.name)` from `@nestjs/common`, routed through nestjs-pino.
- Client: the Peluffo SPA in `../frontend`, served from the same site (Vite proxy in development).
- Language: code, comments, docs and commits in English. API error messages in English; the frontend owns user-facing copy.

Product rules (decided with the owner; change only with a new decision record):

- Roles that log in: `peluffo`, `colibri`, `fibras`. All three read patients, psychologists and assignments.
- `data/users.json` is never served. It holds argon2id hashes only; add users with `npm run hash-password`.
- Auth: access and refresh JWTs in httpOnly, Secure, SameSite=Strict cookies, never in a response body. See docs/decisions/0001.

Single instance: refresh sessions and rate-limit counters live in process memory. They reset on restart and are not shared. Running more than one instance needs a shared store first.

Departures from the stacks/NESTJS.md reference stack (reason per row):

- ORM (Prisma): not used. Data is four read-only JSON files; nothing writes. Add Prisma with the first write endpoint.
- Auth `bcrypt`: argon2id instead. OWASP's first recommendation; memory-hard as SECURITY.md requires.
- Swagger bearer auth: cookie auth (`addCookieAuth`). Tokens are never readable by client JavaScript.
- Tracing (OpenTelemetry), error tracking (Sentry): not added. No collector or DSN exists yet; add when one does.
- Resilience (`opossum`), outbound HTTP, scheduling, WebSockets: not used. The service makes no outbound calls and has no jobs or sockets.
- Production process (PM2): deferred until a deployment target is chosen.
- Committed `openapi.json` with drift check: deferred; the spec is served at `/docs-json` when `SWAGGER_ENABLED=true`.
- Integration suite (`*.int-spec.ts`): none. There is no database to integrate with; e2e covers the HTTP boundary.

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

- format: npm run format:check
- lint: npm run lint
- typecheck: npm run typecheck
- test: npm run test:all
- build: npm run build
- security: npm run security
  Runs: npm audit --omit=dev --audit-level=high && gitleaks detect --source . --redact

## Overrides

- Replaces stacks/NESTJS.md "Every protected controller MUST carry `@ApiBearerAuth()`".
  Protected controllers carry `@ApiCookieAuth()` instead. Reason: the access token is an httpOnly cookie; there is no bearer header to document.
- Replaces stacks/NESTJS.md "These endpoints MUST exist, version-neutral, with the exposure each one is allowed".
  Only `/api/health/live` exists. Reason: there is no datastore or upstream to check; data loads at boot or the process fails to start, so ready would answer exactly what live answers.
