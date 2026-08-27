# Budget Buddy

Budget Buddy is a portfolio-stage personal-finance application for turning
account activity, budgets, and goals into a focused daily action. The mobile
client uses Expo and React Native; the API is written in Go and persists data
in PostgreSQL.

> This repository demonstrates product and engineering work. It is not a bank,
> investment adviser, or production financial service. Use sandbox credentials
> and fictional data only.

## What is implemented

- Email/password registration, login, token refresh, verification, password
  reset, profile updates, onboarding, and account deletion foundations.
- A 1–500 financial score, budget views, transaction history, goals,
  contributions, quests, wealth leagues, and action-focused daily insights.
- Plaid Sandbox link-token exchange, encrypted access-token storage,
  transaction synchronization, and durable webhook ingestion.
- A social prototype for sharing selected achievements without automatically
  exposing balances, transactions, or exact amounts.
- Notification preferences, inbox/device registration, and a signed entitlement
  webhook foundation for future App Store billing integration.
- Docker-based local API and PostgreSQL development.

Mock data remains available for UI development. Production behavior requires
`EXPO_PUBLIC_USE_MOCK=false`, a running API, a migrated PostgreSQL database,
and valid sandbox or production provider configuration.

## Architecture

```text
Expo / React Native screens
  -> typed feature services
  -> Axios client + Expo SecureStore
  -> Go REST API
  -> PostgreSQL
  -> Plaid API / SMTP / entitlement provider adapters
```

The frontend keeps endpoint paths in `src/api/endpoints.ts` and transport logic
in `src/api/client.ts`. Go route modules live under `backend/internal/`, while
ordered PostgreSQL migrations live in `backend/migrations/`.

## Technology

- Expo SDK 54, Expo Router, React Native, TypeScript
- React Query, Zustand, Axios, NativeWind
- Go 1.26 with `net/http`
- PostgreSQL with `pgx`
- Docker Compose
- Plaid Sandbox and React Native Plaid Link

## Local setup

### Mobile

```bash
cp .env.example .env
npm ci
npm run start
```

The checked-in `.env.example` contains public client configuration and
placeholders only. Values prefixed with `EXPO_PUBLIC_` are bundled into the
client and must never contain secrets.

### API and database

```bash
cp backend/.env.example backend/.env
docker compose up -d db
docker compose run --rm migrate
docker compose up -d --build api
```

The sample Docker configuration uses development-only credentials. Replace all
secrets and validate production configuration before any deployment.

For a physical iPhone, point `EXPO_PUBLIC_API_URL` to the Mac's reachable LAN
address rather than `localhost`. Use HTTPS for every production API URL.

## Security design

- Tokens are stored in Expo SecureStore rather than AsyncStorage.
- Production client configuration rejects non-HTTPS API URLs.
- Access tokens enforce a fixed signing algorithm, issuer, subject, issued-at,
  expiry, token type, and bounded lifetime.
- JSON endpoints use strict decoders with hard request-size limits, reject
  unknown fields, and reject trailing JSON values.
- Plaid webhooks require ES256 verification, a recent issuance time, and a
  constant-time comparison of the exact request-body SHA-256 hash; duplicate
  payloads are retained only once.
- The API configures timeouts, header limits, explicit CORS origins, security
  headers, and rate limiting.
- GitHub CI runs TypeScript, Expo, npm audit, Go tests, race detection, vet, and
  govulncheck. Dependabot monitors npm, Go modules, and Actions.

These controls reduce risk but do not constitute a security certification.
See [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## Verification

```bash
npm run typecheck
npx expo-doctor
npm audit --audit-level=critical

cd backend
go test ./...
go test -race ./...
go vet ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.7.0 ./...
```

Native Plaid Link, push notifications, and device-specific behavior still
require signed builds and physical-device testing; command-line checks cannot
replace those tests.

Expo Doctor's React Native Directory metadata check intentionally excludes the
official Plaid Link SDK because the directory currently marks it as untested on
the New Architecture. This is a documented compatibility exception, not proof
of device compatibility; signed iOS and Android builds remain required.

The current Expo 54 toolchain also has upstream Metro build-time advisories that
cannot be removed without a major Expo upgrade. Their dependency path and the
reason for the temporary CI policy are recorded in
[`docs/security-known-advisories.md`](docs/security-known-advisories.md).

## Current limitations

- Plaid is configured for Sandbox during development; production access,
  registered redirect/package identifiers, and a real HTTPS webhook URL remain
  deployment work.
- The entitlement webhook is a provider-neutral foundation. Premium plans are
  unavailable until an App Store billing provider is selected and validated.
- Bud insights and social/league data include development fixtures and are not
  represented as production recommendation or community systems.
- Production monitoring, backups, restore drills, retention jobs, and provider
  reviews remain future work.

## AI-assisted development

AI tools assisted with portions of ideation, implementation, and documentation.
Architecture decisions, source review, testing, security verification, and
final responsibility remain with the maintainer. AI-generated output is not
assumed to be secure, correct, or free of third-party obligations; changes are
reviewed and tested before inclusion.

## License

Budget Buddy is available under the [MIT License](LICENSE). Third-party
dependencies and provider SDKs remain subject to their own licenses and terms.
