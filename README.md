# Peluffo backend

REST API for the Peluffo SPA (`../frontend`): cookie-based JWT login for the three staff roles, and read-only access to patients, psychologists and assignments. NestJS 11 on Express.

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

All routes live under `/api/v1` except `GET /api/health/live`.

| Route                                             | Access                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| `POST /auth/login` `{ username, password }`       | public, 5/min per IP; returns the user, sets cookies |
| `POST /auth/refresh`                              | refresh cookie; rotates both cookies                 |
| `POST /auth/logout`                               | refresh cookie; revokes the session                  |
| `GET /auth/me`                                    | any role                                             |
| `GET /patients`, `/psychologists`, `/assignments` | any role                                             |

Errors always have the body `{ statusCode, code, message }`. Design: [docs/decisions/0001](docs/decisions/0001-cookie-jwt-auth-and-json-data.md).

## Data

`data/*.json` is read once at boot; edit and restart. Add or change a user password:

```bash
printf %s 'new-password' | pnpm -s hash-password   # paste the output into passwordHash
```

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
