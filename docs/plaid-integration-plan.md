# Plaid Integration Plan

Budget Buddy should start with Plaid Sandbox locally, then move the same backend
contract to AWS before production. The Expo app must never store Plaid secrets
or Plaid access tokens.

## MVP Products

- `transactions`: account list, balances available through Plaid data, and
  transaction sync for budgeting.
- Add `liabilities`, `investments`, or `identity` only after the user consents
  to those scopes in Plaid Link and the app has a real screen that needs them.
- Do not use Auth for payments or ACH unless Budget Buddy adds a payment or
  account-verification workflow later.

## Local Backend Env

Set these on the Go API container or local shell:

```bash
PLAID_ENV=sandbox
PLAID_CLIENT_NAME="Budget Buddy"
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
PLAID_ANDROID_PACKAGE_NAME=
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_TOKEN_ENCRYPTION_KEY=...
```

`PLAID_TOKEN_ENCRYPTION_KEY` must be a long random secret from a password
manager or secrets manager. It is used to encrypt Plaid access tokens before
they are stored in Postgres.

Set `PLAID_ANDROID_PACKAGE_NAME=com.budgetbuddy.app` only after it is registered
in Plaid Dashboard. Until then, leave it blank for iPhone/Sandbox testing.

## Backend Contract

- `GET /v1/plaid/status`: private readiness and linked-account summary.
- `POST /v1/plaid/link-token`: creates a short-lived Plaid Link token.
- `POST /v1/plaid/exchange`: exchanges a public token, encrypts the access
  token, and stores linked item/account metadata.
- `GET /v1/plaid/accounts`: same private summary as status for now.
- `POST /v1/plaid/sync`: runs cursor-based Transactions Sync, reconciles linked
  goal contributions, and refreshes budget recommendations.
- `POST /v1/plaid/webhook`: records Plaid webhook payloads for the durable
  database-backed worker.

## Frontend Contract

The Bank Connections settings screen should:

- show missing Plaid config while local credentials are absent;
- create a Link token once the backend is configured;
- open native Plaid Link after `react-native-plaid-link-sdk` is installed;
- exchange the public token with the backend after Link succeeds;
- show linked account names and masks only in private account settings.

## Production/AWS Path

- Go API: ECS Fargate, App Runner, or a small EC2/ECS setup behind HTTPS.
- Database: RDS Postgres with migrations run in deployment.
- Secrets: AWS Secrets Manager or SSM Parameter Store for Plaid and JWT keys.
- Public URL: `https://api.<domain>/v1` for Expo `EXPO_PUBLIC_API_URL`.
- Webhook URL: `https://api.<domain>/v1/plaid/webhook`.
- Logs/alerts: CloudWatch, plus webhook failure alerting before launch.
- Verify Plaid webhook JWT signatures before accepting production webhooks.

## Legal And Compliance Before Production

- Budget Buddy Privacy Policy URL.
- Budget Buddy Terms of Service URL.
- Account deletion and data export request path.
- Plaid Dashboard company and app profile.
- Plaid Dashboard use case selection for data transparency messaging.
- Plaid production access review, including any required security questionnaire.
- iOS bundle identifier and Android package registered as `com.budgetbuddy.app`.

## Sandbox Test

Plaid Sandbox test institution credentials:

- username: `user_good`
- password: `pass_good`
- MFA code: `1234`
