# Backend Contract And Production Roadmap

The mobile API base path remains `/v1`. Frontend services should not add an
extra `/api` segment unless the deployed gateway rewrites `/api` to `/v1`.

## Budget Suggestions

`GET /v1/budget/suggestions`

- Uses the trailing three months of posted Plaid transactions.
- Detects income from income/payroll categories and excludes account transfers.
- Allocates 50% of detected monthly income to needs, 30% to wants, and returns
  the remaining 20% as `savingsTarget`.
- Returns category suggestions with `source: "bud_recommended"`.
- Does not save suggestions as the user's budget.

`PUT /v1/budget/categories/{categoryId}/limit`

```json
{ "amount": 425 }
```

Saves one category limit. A value matching Bud's suggestion is persisted as
`bud_recommended`; an edited value is persisted as `user_adjusted`.

`POST /v1/budget/suggestions/apply`

```json
{
  "categories": [
    { "categoryId": "housing", "amount": 1400 },
    { "categoryId": "food", "amount": 450 }
  ]
}
```

Saves the accepted/edited set. Limits are user-level records, so they continue
month to month until changed.

## Goal Tracking

`POST /v1/goals/{id}/contribution`

```json
{ "amount": 125, "date": "2026-06-13" }
```

The date accepts `YYYY-MM-DD` or RFC 3339. The old `/contribute` route remains
as a compatibility alias.

Goal responses include:

```json
{
  "alreadySaved": 800,
  "currentAmount": 800,
  "trailing30DayContribution": 300,
  "projectedCompletionDate": "2027-08-07T14:38:20Z"
}
```

`projectedCompletionDate` is recalculated from positive contributions in the
last 30 days. It is `null` until the user has a recent contribution pace.

Automatic Plaid updates require a goal's `linkedAccountId` to point to an
active savings, money market, or cash-management account. One active goal can
own a linked account in the current MVP model. Posted `TRANSFER_IN`
transactions create idempotent `plaid` contributions; replayed or modified
transactions do not double count.

## Must Finish Before Production

1. Verify Plaid webhook JWT signatures before accepting payloads. The durable
   worker and retries are implemented, but the public webhook route must not
   launch without Plaid's signature verification flow.
2. Add goal archive/delete, contribution history, and milestone APIs. Goal edit
   is implemented, including assigning or clearing `linkedAccountId`.
3. Add budget transaction recategorization, manual entries, category detail,
   and merchant-learning rules. The frontend currently lists these routes.
4. Replace the generic entitlement webhook with the chosen App Store billing
   provider adapter and production signature validation.
5. Add data export/deletion job tracking, audit logs, monitoring, error alerts,
   backups, restore drills, and API-level retention analytics.
6. Run Plaid production access review, register redirect/package identifiers,
   and configure the real HTTPS webhook URL.

## Implement After The Core Launch Path

- AI-generated Bud insights and structured Bud memory.
- Quest personalization across multiple goals, full skill trees, and live
  league scoring.
- Recurring bill detection, money leaks, debt tools, Future You, and financial
  simulations.
- Near-real-time social feed delivery, share-card rendering, referrals, and
  Phase 3 community circles.
- Investment/liability products and a fully auditable net-worth screen.

The launch path should first make onboarding, Plaid sync, budget review, goal
progress, notifications, billing access, account deletion, and core analytics
reliable end to end.
