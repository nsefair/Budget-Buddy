# Budget Buddy Backend

Go API service for Budget Buddy. This first pass is intentionally small:

- standard-library HTTP server
- environment-based config
- JSON health endpoints
- Dockerfile for container builds
- PostgreSQL migrations for identity, onboarding, and goals

The mobile app already centralizes all endpoint paths in `src/api/endpoints.ts`.
Keep this backend aligned with those paths and only change the frontend endpoint
file if a route truly changes.

## Local Run

Install Go 1.25+ first.

```bash
cd backend
cp .env.example .env
go run ./cmd/api
```

Health checks:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/v1/health
```

## Docker Run

From the repo root:

```bash
docker compose up -d db
```

Run migrations with the migration profile:

```bash
docker compose run --rm migrate
```

Then build and start the API:

```bash
docker compose up -d --build api
```

Postgres is mapped to `localhost:5433` on the Mac so it does not collide with
another local Postgres. Inside Docker, services still use `db:5432`.

## Connect The Expo App

In the mobile `.env`, use:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080/v1
EXPO_PUBLIC_USE_MOCK=false
```

When testing on a physical iPhone, `localhost` means the phone, not your Mac.
Use your Mac's LAN IP instead, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.25:8080/v1
```

Production builds must use HTTPS; the current frontend intentionally refuses
plain HTTP outside development.

## Plaid Local Setup

Plaid stays backend-only. Do not put `PLAID_SECRET` or Plaid access tokens in
Expo env vars. For local sandbox work, export the backend variables before
rebuilding the API container:

```bash
export PLAID_ENV=sandbox
export PLAID_CLIENT_NAME="Budget Buddy"
export PLAID_PRODUCTS=transactions
export PLAID_COUNTRY_CODES=US
export PLAID_ANDROID_PACKAGE_NAME=
export PLAID_CLIENT_ID=...
export PLAID_SECRET=...
export PLAID_TOKEN_ENCRYPTION_KEY=...
docker compose up -d --build api
```

`PLAID_TOKEN_ENCRYPTION_KEY` must be a long random secret. The API uses it to
encrypt Plaid access tokens before storing them in Postgres.

Set `PLAID_ANDROID_PACKAGE_NAME=com.budgetbuddy.app` only after that package is
registered in the Plaid Dashboard. iPhone Sandbox testing can create Link tokens
without sending the Android package name.

See `docs/plaid-integration-plan.md` for the full order of work, AWS path, and
production/legal checklist.

## Auth + Onboarding Contract

The first implemented feature is the account/onboarding boundary:

- `POST /v1/auth/register` creates the user and returns
  `onboardingComplete: false`.
- `POST /v1/user/onboarding` stores the onboarding profile, creates the first
  goal if one does not exist yet, and flips `onboardingComplete` to `true`.
- `POST /v1/auth/login` and `GET /v1/auth/me` always return the persisted
  `onboardingComplete` value, so existing users do not see onboarding again.
- The frontend stores a local `has_known_account` flag after register/login, so
  a returning device without a valid token lands on Login instead of Sign Up.

## Migration Rules

- Every schema change gets a numbered `up.sql` and `down.sql`.
- Store money as integer cents.
- Never store Plaid access tokens or refresh tokens in plaintext.
- Keep social/Buds tables privacy-safe: no transaction or balance data should
  ever be visible through public profile endpoints.
