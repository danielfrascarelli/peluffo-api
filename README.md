# Peluffo backend

REST API for the Peluffo SPA (`../frontend`): cookie-based JWT login for three staff roles, Google Sheets extraction for administrators, and access to accumulated patients, psychologists and assignments. NestJS 11 on Express.

## Prerequisites

- Node.js 24 (`nvm use` reads `.nvmrc`), pnpm 10 (`packageManager`)
- gitleaks, for `pnpm security`

## Setup

```bash
nvm use
pnpm install --frozen-lockfile
cp .env.example .env   # then set both JWT secrets: openssl rand -base64 48
pnpm start:dev      # http://localhost:3000
```

Frontend: set `VITE_API_URL=/api/v1` in `../frontend/.env`; the Vite dev server proxies `/api/v1` to port 3000, so cookies stay same-origin.

## Environment

| Variable             | Default              | Notes                                         |
| -------------------- | -------------------- | --------------------------------------------- |
| `NODE_ENV`           | `development`        | `development` pretty-prints logs              |
| `PORT`               | `3000`               |                                               |
| `LOG_LEVEL`          | `info`               | pino level                                    |
| `CORS_ORIGINS`       | required             | comma-separated origin allowlist              |
| `TRUST_PROXY`        | `loopback`           | Express `trust proxy`                         |
| `JWT_ACCESS_SECRET`  | required, **secret** | ≥ 32 chars                                    |
| `JWT_REFRESH_SECRET` | required, **secret** | ≥ 32 chars, different from the access secret  |
| `JWT_ACCESS_TTL`     | `900`                | seconds                                       |
| `JWT_REFRESH_TTL`    | `604800`             | seconds                                       |
| `DATA_DIR`           | `data`               | JSON files location                           |
| `SWAGGER_ENABLED`    | `false`              | Swagger UI at `/docs`; keep off in production |

## API

All routes live under `/api/v1` except the health routes under `/api/health`.

| Route                                             | Access                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `POST /auth/login` `{ username, password }`       | public, 5/min per IP; returns the user, sets cookies          |
| `POST /auth/refresh`                              | refresh cookie; rotates both cookies                          |
| `POST /auth/logout`                               | refresh cookie; revokes the session                           |
| `GET /auth/me`                                    | any role                                                      |
| `GET /patients`, `/psychologists`, `/assignments` | any role                                                      |
| `GET /statistics`                                 | `peluffo`, `fibras`; accumulated aggregate statistics         |
| `POST /data/extractions`                          | `fibras` only; captures Sheets and publishes accumulated data |

Errors always have the body `{ statusCode, code, message }`. Design: [docs/decisions/0001](docs/decisions/0001-cookie-jwt-auth-and-json-data.md).

## Google Sheets

The backend reads a private Google Sheet as the service account `peluffo-sheets-reader@peluffo-api.iam.gserviceaccount.com` (GCP project `peluffo-api`).

1. Ask the owner for the key, or create one in GCP (IAM → Service Accounts → Keys). Save it as `secrets/google-sa.json`; `secrets/` is git-ignored.
2. Share the sheet with the service account email as Viewer.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_SHEET_ID` in `.env`, start the app, log in, and call `GET /api/health/dependencies`.

A 403 means the sheet is not shared with the service account, or the Sheets API is disabled in the project. A 404 means the id is wrong.

## Data

`data/users.json` is read only at boot. Add or change a user password:

```bash
printf %s 'new-password' | pnpm -s hash-password   # paste the output into passwordHash
```

### Extract and process

Call `POST /api/v1/data/extractions` with a `fibras` access cookie. No request body is needed. It reads `PELUFFO GIGUENS!A:S` using the configured Sheet and service account; concurrent requests return `409 EXTRACTION_IN_PROGRESS`.

Each UTC-named snapshot under `DATA_DIR` contains:

- `source.json`: original cell values, display values, headers and row numbers, including invalid rows.
- `extracted/{patients,psychologists,assignments}.json`: only valid records from that capture.
- `processed/{patients,psychologists,assignments}.json`: the accumulated result; absent patients and their relationships remain.
- `report.json`: `warnings` and blocking row `errors`, with row, field, code, message and actionable `context`. Row issues include patient name/original cedula, affected column letters and original displayed cell values. Duplicate cedulas include the normalized cedula and all related row numbers; header errors include received and expected values and sheet titles. Assignment messages distinguish missing dates, invalid dates and missing/invalid psychologists. Unrelated clinical fields are excluded. This sensitive report is restricted to the admin response and local snapshots, never logs. Reports are not emailed yet.

The response includes `extractionId`, `path`, `reportPath` (relative to `DATA_DIR`), `changed`, `checkedAt`, `applied`, extracted/processed counts, warning/error counts and a full `report` with `warnings` and `errors`. Invalid rows do not stop valid rows. If no patients are valid, a changed capture and report are saved with `applied: false`; no processed directory is created and active resources stay unchanged.

Each invocation reads and validates the Sheet in memory. SHA-256 compares its A:S content (including formulas, original/calculated/display values and row positions), excluding capture time. Object-key ordering and empty padding do not count as changes; text is not trimmed for comparison. Styles that do not affect displayed values do not count. A changed capture returns `201`; an unchanged one returns `200`, `changed: false`, `applied: false`, and reuses existing snapshot paths. Unchanged requests do not write any files or replace in-memory resources, but still return fresh parsing warnings and errors every time. Archived reports remain immutable: improved diagnostic context appears in the current inline `report`, even when the archived report predates that improvement. This permits hourly external invocation without repeated snapshots; no scheduler or email delivery is included. Parser code changes alone do not invalidate the content fingerprint.

`current.json` stores `extractionId` (active processed snapshot, when present), `lastExtractionId` (last successfully stored capture) and `sourceHash`. The latest capture can be empty or invalid without changing the active processed snapshot. Legacy references containing only `extractionId` remain readable: the baseline is calculated from their stored `source.json`, without rewriting the reference on an unchanged request. Comparison survives process restarts.

The reference is replaced atomically only after the complete snapshot exists; the process then switches its in-memory resources without restarting when processed data was published. Without an active reference, resource endpoints return empty lists. Invalid references, corrupt resources/captures or missing files fail startup rather than silently falling back. A complete snapshot left by a failed reference publication is not a successful baseline: subsequent requests retry publication. The reference is authoritative; do not select the newest directory by its name.

There are no active resource JSON files at the data root. Keep `DATA_DIR` on one local filesystem, writable by the service account. Back up the directory, including `current.json`; restore them together. Snapshots and references are ignored by Git. Preserve them across deployments. Files are created with owner-only permissions. Do not publish `data/` through a static web server.

Patient updates merge by normalized cedula; blank or invalid new fields do not erase prior values. Every occurrence of a duplicated cedula in a capture is excluded. Prior valid accumulated data for those patients remains. Ages such as `34 años` are parsed; invalid ages are omitted and reported. Dates are interpreted in `America/Montevideo`, not the server timezone.

Patients expose `assignmentStatus: assigned | pending`. A present patient with incomplete Q/R data becomes pending. Replaced or removed assignments retain history through `closedObservedAt`, the instant the change was detected, not a claimed clinical end date. Psychologists are identified by normalized full name; two different people with identical names cannot be distinguished by this Sheet.

The resource contract uses `fullName`, optional `age`, `ageRecordedAt` and `submittedAt`, and independent `healthProvider`/`healthProviderName`. A valid age and submission timestamp form one observation: `ageRecordedAt` preserves that age's reference even if a later invalid age arrives with a corrected submission date. Updates replace this pair only when both new values are valid. The existing frontend still expects the previous mock contract; its migration is a separate task. See [decision 0004](docs/decisions/0004-captured-and-accumulated-sheet-data.md) and [change detection decision 0005](docs/decisions/0005-content-based-extraction-deduplication.md).

### Statistics

`GET /api/v1/statistics` requires a `peluffo` or `fibras` access cookie. It aggregates one consistent in-memory processed snapshot; it never reads Google Sheets, scans historical folders, or writes files. History already lives in accumulated patients and assignments. No filters in v1. Frontend wiring is separate.

The response includes `generatedAt` (UTC), `timeZone: America/Montevideo`, `month` (`YYYY-MM`) and `totalPatients`. All charts use accumulated unique patients, including patients absent from the latest Sheet. Dates use one request-time clock, not the server timezone.

| Response field              | Calculation / chart contract                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary.activePatients`    | Latest valid `assignmentStatus === assigned`. Operational assignment status, not verified clinical activity.                                                                                                                                                                                                                                |
| `summary.waitingPatients`   | Latest valid `assignmentStatus === pending`.                                                                                                                                                                                                                                                                                                |
| `summary.assignedThisMonth` | Distinct patients with any assignment starting this local month, through today. Includes closed historical assignments; multiple assignments count once. Future assignment dates excluded.                                                                                                                                                  |
| `summary.finishedThisMonth` | `null`; `finishedUnavailableReason: TREATMENT_END_NOT_COLLECTED`. `closedObservedAt` never implies clinical discharge.                                                                                                                                                                                                                      |
| `cumulativePatients`        | `data: [{month,total}]`, exactly 12 chronological months through the current month. Count each patient by their latest valid processed `submittedAt`, carry earlier requests into the first bucket, and accumulate. Current month stops at the request instant. `missingDateCount` and `futureDateCount` identify excluded patients.        |
| `ageDistribution`           | `basis: estimated`, `asOfMonth`, `data: [{key,count}]`. Keys always `le18`, `19_25`, `26_35`, `36_50`, `gt50`, including zero counts. Estimated age = declared age + floor(elapsed local months / 12) since `ageRecordedAt`. No birth-date precision is implied. `missingCount` includes missing age/reference and future reference months. |
| `sexDistribution`           | `available: false`, `reason: SEX_NOT_COLLECTED`, `data: []`, `missingCount: totalPatients`. Never infer sex from names.                                                                                                                                                                                                                     |
| `departmentDistribution`    | `basis: derived_from_city`, `data: [{department,count}]`. Official locality match, count descending, department name for ties. Missing/ambiguous/unrecognized cities use a final `department: null` bucket; `unresolvedCount` repeats its count, not an additional category. Zero-count departments omitted.                                |

Age example: 40 declared in January 2024 becomes an estimate of 42 in October 2026. Changing `submittedAt` without a valid new age does not re-anchor the previous age. At startup, legacy processed ages receive an in-memory reference only when the same active published extracted patient's ID, age and submission timestamp match; unconfirmed observations stay unavailable. Explicit references remain intact. No immutable snapshot is rewritten and unchanged-Sheet extraction remains idempotent.

Department lookup uses the local [INE Census 2023 catalog](docs/data/ine-localities.md). Normalization only removes accents, case differences, duplicate whitespace and trailing periods. No comma splitting, fuzzy matching or geocoding; ambiguous locality names remain unresolved. Original patient `city` values stay unchanged and never appear in aggregate responses. See [decision 0006](docs/decisions/0006-accumulated-patient-statistics.md). Swagger documents the complete response at `/docs` when enabled.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:all     # unit + e2e
pnpm build
pnpm security
```

## Build and deploy

`pnpm build` emits `dist/`; run with `pnpm start`. Deployment target is not chosen yet. Run a single instance (see AGENTS.md).

Logging uses `new Logger(ClassName.name)` from `@nestjs/common`, routed through nestjs-pino as JSON with a request id per line.

Standards: [.standards](.standards/README.md) (git submodule). After cloning: `git submodule update --init`.
