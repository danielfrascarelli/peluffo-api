# 0001 Cookie-based JWT auth over read-only JSON data

Date: 2026-10-19 · Status: superseded in part by 0003

## Context

The frontend shipped with mock data in `public/api/*.json`, including `users.json` with plaintext passwords, checked in the browser. Anything in `public/` is downloadable by anyone, patient data included. The backend replaces both: it serves the data behind authentication and validates logins server-side.

## Decision

- Data: `data/{patients,psychologists,assignments}.json` copied from the frontend, read once at boot, served read-only at `GET /api/v1/<resource>`. `data/users.json` holds argon2id hashes and is never served. Superseded for resource extraction by 0003.
- Login: `POST /api/v1/auth/login` verifies argon2id; unknown usernames are verified against a dummy hash so both failures take the same time. 5 attempts per minute per IP.
- Tokens: two HS256 JWTs with distinct secrets, a `type` claim checked on verify, pinned algorithm, issuer and audience.
  - Access: 15 minutes, cookie `__Host-access_token`, `Path=/`.
  - Refresh: 7 days, cookie `__Secure-refresh_token`, `Path=/api/v1/auth`, so only refresh and logout ever receive it. `maxAge` comes from the token's `exp`.
  - Both cookies: `HttpOnly; Secure; SameSite=Strict`. `Secure` is unconditional; browsers accept it on `http://localhost`.
- Sessions: each login starts a refresh token family. `POST /auth/refresh` rotates: the family keeps only its newest `jti`. Presenting an older one revokes the family (reuse detection). `POST /auth/logout` revokes it.
- CSRF: `SameSite=Strict` on same-site deployment; cross-site requests carry no cookies. No CSRF token.
- Authorization: a global guard denies every route that is neither `@Public()` nor carries a matching `@Roles(...)`.

## Alternatives rejected

- Access token in memory plus `Authorization` header: survives XSS no better than a cookie the script cannot read, and loses the session on reload.
- Stateless refresh tokens: a stolen cookie would stay valid for its full lifetime.
- `SameSite=None` with a CSRF token: only needed if frontend and backend end up on different sites.
- Prisma now: no writes exist yet, so a database would hold four static files.

## Consequences

- Sessions and rate-limit counters are in-process: a restart logs everyone out, and the service must run as a single instance until they move to a shared store.
- Two tabs refreshing at the same instant can trip reuse detection and log the user out. The frontend serializes refreshes per tab.
- Frontend and backend must share a site. A cross-site deployment needs `SameSite=None` plus CSRF tokens, in the same change.
- Assignment writes still live only in the frontend query cache. Google Sheets extraction is defined by 0003.
