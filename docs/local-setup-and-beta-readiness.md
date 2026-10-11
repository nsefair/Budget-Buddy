# Budget Buddy: development and readiness

Updated October 10, 2026. This is a public portfolio repository for an app in active
development. User accounts, bank credentials, and financial records remain
private. There is no public launch, TestFlight release, or tester invitation.
This report replaces the older handoffs; their history remains in Git.

## Current implementation

- Expo 57 / React Native 0.86, iOS scene lifecycle support, and the Reanimated
  adaptive-color crash fix are integrated. TypeScript stays on the Expo-compatible
  6.0 line. Native build success is separate from an on-device acceptance test.
- Today uses the deterministic Go money engine: income/payday/bills/goal setup,
  calculation details, manual spending with retry protection, and bank freshness.
- **Recalculate safe to spend** on Today syncs a linked bank and refreshes the
  money calculation. Budget provides explicit bank sync and a recalculation
  action using the imported ledger. Repeated tab visits do not trigger bank API
  calls automatically.
- **Edit income & plan** reuses setup with saved values. Saving calculates and
  persists the updated result in the same database transaction. The existing
  morning allowance remains fixed for the local day; lower available funds can
  reduce today's remainder immediately, and the new plan informs future days.
- Budget refreshes on tab focus and pull-to-refresh. Month totals, spending
  categories, and category drill-downs share one bank-ledger classification.
  Category filtering precedes pagination; the calendar traverses every page.
- Incoming transactions now appear in history. Received income means **posted,
  classified bank income**, not the income declared in the Today plan. Pending
  income, refunds, and ambiguous incoming transfers are not counted as wages.
- Pending purchases count once; posted replacements remove their pending copy.
  Posted categorized refunds offset their category, floored at zero. Known
  internal transfers and loan/card repayments do not count as spending.
  Ambiguous outgoing transfers such as unclassified Zelle payments are visible
  as **Uncategorized** and conservatively count as spending. No guessed Shopping
  fallback remains. Categorization follows Plaid metadata, including detailed
  education/automotive categories; bank metadata can still be imperfect.
- Bank sync refreshes authorized account metadata and cached balances before
  importing transactions, repairs previously unlinked rows, and commits accounts,
  entries, and the cursor together. Failed account refreshes do not advance the
  cursor or report successful sync. Only active accounts on unarchived Items
  contribute to Budget; its dollar totals include USD transactions only.
- Budget is bank history; Today additionally reconciles manual spending and
  excludes declared fixed bills from flexible spending. Their totals have
  different meanings and are not interchangeable.

## UI pass (October 10)

- Calm, shared visual language across tabs: light glowing headers, 22pt
  hairline cards, round tinted icon tiles, and thin bars. Numbers roll in and
  bars grow when a tab regains focus; Reduce Motion keeps them static.
- Bud is a calm conversation with honest replies: goal pace is arithmetic on
  goal settings, learning topics are general education, and open questions say
  the full assistant is not ready. There is still no AI backend (`/bud/ask`).
- Budget category limits are display-only for now; the editable starting
  budget was removed. Onboarding uses segmented progress and cascading
  options; launch plays a short ripple-and-dissolve over the app.
- `babel.config.js` no longer routes JSX through NativeWind. The app styles
  with `StyleSheet` only, and that interop silently dropped `Pressable` style
  callbacks. NativeWind's Metro watcher can still crash Metro when files are
  added or removed; restart with `npx expo start --dev-client --lan --clear`.

## Branches and dependencies

The consolidation includes compatible Go, GitHub Actions, browserslist, browser
mapping, selector-parser, and XML-parser updates. Old fast-uri and undici patches
are superseded because those packages are absent from the Expo 57 lockfile.
The old broad production upgrade mixes unsupported React Native, Reanimated,
Worklets, and Tailwind versions; TypeScript 7 also needs a separate compatibility
pass. Do not merge those upgrades merely to clear the branch list.

Expo 57 patch releases, Go 1.26.9, and a `shell-quote` 1.11.0 override landed
on October 10. Expo SDK 58 (which clears a moderate `decode-uri-component`
advisory) and TypeScript 7 belong to a planned upgrade. The hosted API keeps
its Go 1.26.6 build until the next guarded deployment.

Dependabot groups routine updates and limits open requests. CI runs database
integration tests against disposable PostgreSQL, money-input tests, and the AWS
credit-guard tests in addition to type checks, Go race tests, vet, and scans.

## Run locally

Start Docker Desktop, then double-click `Start Budget Buddy.command`. It starts
PostgreSQL, applies migrations, starts the local API, opens Xcode, and starts
Metro. Keep Metro open for development builds. The checked-in examples are for
local development; real credentials belong only in ignored environment files.

```sh
npm ci
npm run typecheck
docker --context desktop-linux compose up -d db
docker --context desktop-linux compose run --rm migrate
```

The local backend uses Plaid sandbox. The configured phone build points to
`https://api.budgetbudd.com/v1`, with mock mode off. A phone needs the Mac's Metro
server on the same Wi-Fi; the LAN address can change. Native dependency changes
require a new development build, not just a Metro restart. Plaid needs a native
development build rather than Expo Go.

## AWS and credit controls

The existing single-host pilot in `us-east-2` runs the API, private PostgreSQL,
and Caddy at `https://api.budgetbudd.com`. Database port 5432 is not public.
All 17 migrations were applied before this work; these fixes require none.
Private encrypted daily backups run at 06:00 UTC with 14-day retention; a restore
was verified on October 4. Admin viewing is the fixed read-only SSM query in
`infra/aws/view-users.py`, with private snapshots in ignored `.cache/admin/`.

On October 5, the guard verified an **active Free plan**, **$113.72 credits**,
and expiration **March 17, 2027**. It blocks deployment below a $15 reserve or
within seven days of expiry. Existing $15/month budget alerts are notifications,
not an automatic spending cap; ongoing resources continue consuming credits.
Never upgrade to Paid or add paid-only services.

```sh
aws login --profile budget-buddy
python3 infra/aws/guard.py --account 455012390237
```

Run the guard immediately before any deployment or provisioning. A failed guard
blocks that work. Do not print runtime parameters, tokens, account directories,
or database dumps. Synthetic tests use no real bank Items.

## Verification and remaining work

October 5 checks passed: TypeScript, 21/21 Expo Doctor checks, iOS JavaScript
bundle export, money-input tests, AWS guard tests, Go race tests with the local
PostgreSQL integration suite, vet, and diff checks. `govulncheck` found no called
vulnerabilities (three advisories remain in required modules). Npm audit reports
30 advisories: 19 high, 11 moderate, zero critical.

The API-only update is deployed to the existing host as `beta-20261005-1`, digest
`sha256:8e4838a312adf03948f0128273571249b64adb97170fca8f9cab54c7c3c8b9a4`.
HTTPS smoke checks passed for auth, persisted income edits, fixed morning
snapshots, manual-entry retries, goal allocation, received bank income, pending
spending, and Uncategorized/category drill-downs. Only disposable synthetic
records were used and removed. No real Plaid Item or new cloud service was
created; database and proxy containers were not replaced. The previous image
configuration is retained on the host for rollback.

These checks establish API behavior and a successful mobile bundle, not a
fresh physical-iPhone UI acceptance run. The development client needs the latest
Metro code for the new buttons.

Local regression coverage exercises payroll visibility, refunds, Zelle fallback,
pending replacement, category pagination, month/card agreement, cross-user
isolation, archived Items, account import/repair, and fixed morning snapshots
when income changes. A passing suite does not establish that every real bank
transaction is classified correctly or that the physical iPhone flow passed.

Still required before inviting testers:

- Physical-iPhone acceptance of launch, income editing, recalculation, category
  navigation, Plaid reconnect/OAuth, and delayed/error states. The owner reports
  that production Plaid linking works; automated tests do not perform bank login.
- Complete sandbox Link/import/reconnect acceptance and signed public webhook
  delivery verification. Production credentials and token creation alone are
  not a complete bank-link test. Preserve the limited Plaid trial: no automated
  real Items or plan upgrades.
- Apple Developer enrollment, associated domains/Plaid OAuth return, TestFlight,
  and remote-push credentials remain gated on enrollment.
- Automatic income-cycle rollover/detection, overnight scheduling, notifications,
  Bud's real AI integration, and the full score redesign remain future work.
- Profile-menu polish, scroll-linked motion, and chart value tooltips remain
  design follow-ups; physical-iPhone acceptance of the October 10 UI pass is
  owner-reported, not automated.
- Review remaining dependency advisories before beta. Do not apply forced
  framework upgrades to silence an audit.

Provider semantics: [Plaid Transactions API](https://plaid.com/docs/api/products/transactions/)
and [pending/posted lifecycle](https://plaid.com/docs/transactions/transactions-data/).
