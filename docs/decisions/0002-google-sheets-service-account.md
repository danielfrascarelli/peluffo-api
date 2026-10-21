# 0002 Google Sheets access through a service account

Date: 2026-10-20 · Status: accepted

## Context

The backend must read a private Google Sheet in Drive. It is shared only with a few accounts, and the owner's personal Gmail is one of them. The backend will run on AWS EC2, deployed by GitHub Actions: the workflow builds a zip, and CodeDeploy runs hook scripts on the instance. The owner's Gmail credentials must not be stored anywhere. A leaked credential must not put the Gmail account at risk.

## Decision

- Identity: the service account `peluffo-sheets-reader@peluffo-api.iam.gserviceaccount.com` in the GCP project `peluffo-api` (number 939910453144, no organization, owned by the owner's Gmail).
  - It has no IAM roles. It sees only the sheets shared with it, as Viewer.
  - Scope: `spreadsheets.readonly`. Only the Sheets API is enabled; Drive API is not needed.
- Credential: a JSON key.
  - Local development: `secrets/google-sa.json` (git-ignored, mode 600). The path goes in `GOOGLE_APPLICATION_CREDENTIALS`.
  - Production (not built yet): the key is an SSM Parameter Store SecureString at `/peluffo-api/prod/google-sa-key`. A CodeDeploy `AfterInstall` hook fetches it with the instance role into `/etc/peluffo-api/` (mode 600). The JWT secrets follow the same path. GitHub never holds the key.
  - GitHub authenticates to AWS through OIDC, not access keys.
- Check: `GET /api/health/dependencies` (any role) reads the sheet's metadata only (title and tab names), with a 5 s timeout. It returns 503 `DEPENDENCY_UNAVAILABLE` with the reason when access fails.

## Alternatives rejected

- OAuth refresh token for the owner's Gmail: a leak exposes every sheet the owner can read, and tokens of a "testing" OAuth app expire after 7 days.
- A second Gmail account: a password, 2FA and recovery to maintain, for no gain over a service account.
- The key in GitHub Secrets, injected at deploy: CodeDeploy can only receive it inside the zip, which S3 keeps with every revision.
- Workload Identity Federation from the EC2 role, which needs no key: the better end state, but more GCP setup. Revisit once the deploy exists.

## Consequences

- A leaked key exposes only the sheets shared with the service account. Revoke it in IAM → Service Accounts → Keys.
- The key is long-lived; rotation is manual: create a new key, update SSM, redeploy.
- A key file must never be placed in `data/`, which is committed.
