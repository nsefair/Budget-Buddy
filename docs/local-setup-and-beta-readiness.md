# Budget Buddy: Mac setup and beta readiness

## Current handoff — October 4, 2026

This section supersedes the October 3 review below. The PDF was used as product
requirements; deployment and account changes were authorized separately by the
user. Work was wrapped up at the user's request. Changes remain local and
uncommitted; no TestFlight release or tester invitation was made.

### Later working-tree changes

- Added `View AWS Users.command` and `infra/aws/view-users.py`. It uses a fixed,
  read-only PostgreSQL query through AWS Systems Manager, writes a private local
  HTML snapshot, and never exposes the database port or returns password hashes.
  At the last refresh the AWS database contained **0 registered users**. Local
  Docker test accounts are separate.
- Fixed the Expo 57/Reanimated crash caused by animating `DynamicColorIOS`
  values through Moti. Adaptive colors now stay in ordinary native styles in
  the onboarding option cards, Budget month chips, and Goals plan chips. The
  iOS 27 simulator loaded onboarding and option selection successfully after
  this change.
- Added the first beta money UI in `src/features/money/`: four-step income,
  payday, bills, and goal setup; the large Safe to Spend Today number; a
  calculation sheet; a retry-safe **I spent** action; freshness/reconnect
  messaging; and the backend money API service. The old Today screen is
  replaced in the working tree. This is a beta implementation checkpoint, not
  a claim that the whole PDF redesign is complete.
- The supplied Safe-to-Spend Today PDF was treated as a design reference. Its
  strongest patterns are now represented: one calm daily number, direct “Why?”
  math, a separate manual-spending action, and context around goals and cycle
  dates. PocketGuard's single leftover number and detail view, and YNAB's
  priority-first summary, informed the adaptation; the calculation remains
  Budget Buddy's own deterministic engine.
- The latest checks passed: TypeScript, backend Go tests, JavaScript money-input
  tests, AWS guard tests, and `git diff --check`. Metro bundled the app and the
  iOS 27 simulator displayed onboarding without the reported crash.
- Product follow-ups from the owner's notes: add a visible **Recalculate safe to
  spend** action after a bank sync and when income changes; polish the profile
  menu; and continue the Quests UI pass. Recalculation should call the existing
  money endpoint using fresh Plaid data and preserve the frozen morning snapshot
  semantics for the current local day.
- The owner reports that the production Plaid real-data connection now works in
  the app. The repository keeps the safer acceptance wording below: a human
  bank login/consent flow still needs to be exercised and documented on the
  physical iPhone before TestFlight.

### Running on AWS

- **HTTPS API:** `https://api.budgetbudd.com`, with `/readyz` returning ready.
  Squarespace now has `api` A → `18.227.252.62`; existing root, www, and mail
  records were preserved. This sets up the API domain, not a marketing website.
- Existing EC2 pilot in `us-east-2` now runs API, PostgreSQL, and Caddy. All
  **17 migrations** are applied on AWS. Deployed ECR tag: `beta-20261004-1`;
  digest: `sha256:fad3ab01687395defec5f5493c1ed080d3bc1efe6aa53224fd3627280e8d3725`.
- HTTPS readiness, login, production Plaid Link-token creation, persisted morning
  allowance, immediate manual spending, and idempotent expense/goal allocation
  passed against the hosted API. The synthetic test user was removed. No bank
  Item was created. Unauthenticated private requests and unsigned webhooks
  returned 401; HTTP redirects to HTTPS.
- Private encrypted S3 database backups run daily at 06:00 UTC, with up to five
  minutes of timer jitter and 14-day retention. The first backup was restored
  into a separate scratch database and verified at migration 17, then removed.
  Bucket: `budget-buddy-pilot-backups-455012390237`.
- Free-plan guard passed; the latest inspected balance was $114.02 in credits, with
  expiry March 17, 2027. Existing $15/month budget alerts remain. These are
  observations at deployment, not a guarantee of future cost or availability.

### Plaid

The correct account's **production Transactions access** was verified. Its key
was saved encrypted in `/budget-buddy/pilot/runtime` without exposing it in this
report. The configured webhook is
`https://api.budgetbudd.com/v1/plaid/webhook`. The dashboard showed **0/10** trial
connections before testing; we did not consume a real connection.

Sync now commits all pages and its cursor atomically, restarts pagination after
mutation errors, serializes concurrent syncs, and preserves pending-to-posted
identity. Reconnect state, Link update mode, account validation, and a beta
capacity reservation check were added. The beta limits users to one bank Item;
Plaid's allowance counts connections/Items and does **not** guarantee ten users
if someone creates replacement or abandoned connections. Provider limits remain
authoritative.

**Still required:** a complete sandbox Link/import/reconnect acceptance run,
public signed-webhook delivery verification, and a real-bank flow on iPhone.
Production token creation confirms credentials and product access, not a
successful bank connection. No real-bank login was performed.

### iPhone and iOS 27 migration

Expo was upgraded to **57.0.26**, React Native to **0.86.3**, and the supported
`expo-build-properties` scene lifecycle option enabled. Native dependencies were
regenerated. TypeScript and **21/21 Expo Doctor checks passed**. The signed
Expo 57 physical-device build passed and was installed on the connected iPhone.
The previous build launched after the user trusted its development profile.
The final launch check for the upgraded build was blocked because the phone
was locked; its on-device launch still needs verification.

Local signing uses Nicolas Sefair's Personal Team and bundle ID
`com.nicolassefair.budgetbuddy.dev`. The user confirmed paid Apple Developer
enrollment is **pending / not enrolled**. TestFlight, production associated
domains for major-bank OAuth return, and remote push credentials remain gated
on enrollment. No production Plaid redirect URI is configured yet.

The iOS 27 simulator build also **passed** at wrap-up; runtime launch is still
unverified. Do not treat a successful compile as a completed iOS 27 regression
test. Logs: `.cache/ios27-build.log`
and `.cache/phone57-build.log`.

The phone's public API setting now points to
`https://api.budgetbudd.com/v1`, mock mode is off, and Plaid is production.
Local Docker backend configuration remains sandbox. Metro is running on LAN;
the last observed Mac IP is `192.168.0.134` and may change. Unlock the phone,
open Budget Buddy, and choose its Metro server while on the same Wi-Fi.
Start Docker Desktop and double-click `Start Budget Buddy.command` after a
reboot; it now applies migrations before starting the API. Keep Metro open.
The existing Metro process reports a simctl discovery warning because it was
started without `DEVELOPER_DIR`; the shortcut sets that variable correctly.

### Beta money engine: backend implemented, mobile integration pending

The deployed authenticated `/v1/money` API supports profile/cycle setup, today's
calculation, manual spending, and yesterday-to-goal allocation. It uses integer
cents, the guide's $38/day anchor, normalized income cadence, partial cycles,
prorated bills/goals, a 10% buffer, local dates, pending purchases, one-to-one
manual matching, refunds, frozen daily baselines, and duplicate-safe goal moves.
Go race tests, database integration tests, and vet passed. Hosted smoke checks
verified the persisted API behavior. Relevant code is in
`backend/internal/money`; reusable hosted checks are in `infra/aws/smoke.py`.

The beta Today screen now uses the money engine. Bud and the remaining beta
onboarding, Spending, and Goals UI still need the final product pass. Cycle
rollover currently requires an explicit confirmed profile update;
automatic income detection is not implemented. Historical income values are
supplied as inputs, not inferred automatically from bank history. Daily
snapshots are created on the first request of the day; an overnight refresh and
7:30 a.m. notification pipeline remain to be built. Bud/Anthropic, the new score,
and the guide's full analytics remain future work.

Latest dependency audit after the framework migration reported 34 advisories
(21 high, 12 moderate, 1 low); dependency-path review remains outstanding. This
is a private pilot foundation, not a completed security audit or beta sign-off.

### Resume in this order

1. Unlock the iPhone and verify the Expo 57 launch; launch the successfully built
   iOS 27 simulator app and complete regression checks.
2. Complete Apple enrollment, configure associated domains and Plaid OAuth
   return, and exercise sandbox then one consented real-bank connection before
   inviting testers.
3. Connect the beta screens to the money API; implement automatic cycle refresh,
   daily scheduling, Bud, and remaining guide requirements.

---

## Historical review — October 3, 2026

The following records the original setup and full meeting-guide review. Its
deployment, framework-version, account, and readiness statements are historical;
use the October 4 handoff above for current status.

Reviewed October 3, 2026. Project: `/Users/nicolassefair/Downloads/BUD/budget-buddy`.

## Outcome

The transferred project has a working local API and PostgreSQL database. JavaScript dependencies, Go tooling, Docker/Colima, AWS CLI, CocoaPods, Xcode, and an iOS simulator runtime are installed. The new beta described in the September 30 meeting guide is a substantial product change, not just a deployment of the existing app.

The native app compiles, but its Expo 54 lifecycle is incompatible with iOS 27 when built using this Mac's Xcode 27. See the native build section for the verified launch limitation and the iOS 26 development fallback. Do not treat a successful build as iOS 27 readiness.

AWS infrastructure exists, but the EC2 machine has not been populated with the application. The configured API hostname does not resolve. Plaid has an implemented sandbox integration, but real-bank beta readiness is not established.

This review treats the meeting PDF as proposed product requirements and context, not authorization to deploy, contact testers, purchase services, or change bank connections. No cloud deployment or beta feature redesign was performed.

## What was reviewed

- Folder inventory, project configuration, application routes and services, Go backend modules, SQL migrations, Docker and AWS deployment files, existing documentation, and the older developer review and visual references.
- All 13 pages of `Budget Buddy Beta Build & Launch Guide.pdf`, including visual inspection. This is the newest product direction. Older architecture artwork and roadmaps describe superseded technology or incomplete milestones.
- Live AWS CloudFormation, EC2, ECR, SSM configuration presence, and read-only inspection of the EC2 host; local build and API checks.

Generated dependencies and build artifacts are not treated as application source. This is a setup and architecture review, not a completed security audit or full screen-by-screen acceptance test.

## Run locally on this Mac

**Daily shortcut:** start Docker Desktop, then double-click `Start Budget Buddy.command` in the project folder. It builds/starts the Go API and PostgreSQL, applies migrations, opens `ios/BudgetBuddy.xcworkspace`, and starts Metro in LAN mode. Keep the Metro terminal open while using the app. The starter explicitly uses Docker Desktop's local context.

From the project directory:

```sh
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
docker --context desktop-linux compose --env-file .env --env-file .env.local up -d db
docker --context desktop-linux compose --env-file .env --env-file .env.local run --rm migrate
docker --context desktop-linux compose --env-file .env --env-file .env.local up -d --build api
curl --fail http://localhost:8080/readyz
npx expo start --dev-client --lan --clear
```

Open **Device Hub** from Xcode > Open Developer Tool. Use **Budget Buddy iOS 26**, not the iOS 27 simulator, for this existing framework version. The native development app is installed there. Open Budget Buddy and select the detected Metro server. A simulator can use `http://localhost:8081`; a physical phone must use the Mac's LAN address. Keep Metro running while developing.

Plaid requires a native development build. The existing `npm run ios` only starts Expo; it does not build missing native dependencies. Expo 54's simulator-opening commands also predate Xcode 27's Device Hub. For native changes, open `ios/BudgetBuddy.xcworkspace` in Xcode, select the iOS 26 simulator and build/run; for JavaScript-only work, use the Metro command above.

### Run from Xcode on your iPhone

The workspace is open in Xcode. Use the **BudgetBuddy** scheme and the **.xcworkspace**, which includes CocoaPods. Do not open the .xcodeproj alone.

1. Connect and unlock the phone; accept Trust if prompted. Xcode last listed `iPhone de Nicolas` (iPhone 14 Pro, iOS 26.6.2) as unavailable, so actual device deployment is pending.
2. Add your Apple ID under Xcode > Settings > Accounts. At the last check this Mac had no Xcode accounts. The transferred project still referenced an existing team ID whose name Xcode could not resolve.
3. Select BudgetBuddy target > Signing & Capabilities > your **Personal Team**. Keep automatic signing enabled.
4. Select **iPhone de Nicolas** in the run-destination menu, then press **Cmd+R**. If iOS requests Developer Mode or developer trust, complete that on the phone.
5. Keep the phone and Mac on the same Wi-Fi. Select the Mac's Metro server in the app's development launcher. The current LAN endpoints were verified as `http://192.168.0.133:8081` (Metro) and `http://192.168.0.133:8080/readyz` (API); this IP can change with Wi-Fi.

Physical-device signing and launch remain unverified until account sign-in and device connection are completed. Xcode is set to the verified **Budget Buddy iOS 26** simulator as a fallback, avoiding accidental use of iOS 27. The app's development API helper substitutes the Metro host for localhost on a physical phone.

The local `.env.local` sets `BUDGET_BUDDY_PERSONAL_TEAM=1`. The opt-in Expo plugin removes the APNs entitlement from generated local builds because this account does not yet have paid enrollment. Ordinary app development and local notifications remain available; remote push testing requires paid credentials. For the paid beta build, remove this local flag (or set it to `0`) and rerun iOS prebuild. Config verification confirmed the default paid-build path retains `aps-environment=development`. See [Expo's push credential requirements](https://docs.expo.dev/push-notifications/push-notifications-setup/).

The ignored `.env.local` selects `http://localhost:8080/v1`, live local API mode, Plaid sandbox, and email delivery to local logs. The transferred `.env` is retained with restricted file permissions. Always include both Compose `--env-file` arguments so local email stays in log mode. Do not publish a build that points to localhost.

Local PostgreSQL listens on port 5433; API on 8080. The new database has all 14 migrations applied. The September 18 database dump in the parent folder is preserved but was not restored. The initial setup used Colima; after Docker Desktop became active, the stack was rebuilt and migrated in Docker Desktop. The earlier Colima volumes are preserved separately and Colima is stopped. Use one runtime at a time. Restart Docker Desktop and run the starter after a reboot. `docker compose down` retains data unless explicitly asked to delete volumes.

### Reproduce native dependencies

`Brewfile` records the required Homebrew packages; `.nvmrc` records Node 22. Xcode and the iOS runtime are separate installs. This Mac has the Node path in `~/.zprofile` and Docker's Homebrew CLI plugin directory configured in `~/.docker/config.json`.

```sh
brew bundle
npm ci
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
npx expo prebuild --platform ios --no-install
pod install --project-directory=ios
```

Native `ios/` and `android/` directories are generated and ignored. The local Expo plugin `plugins/with-minimum-ios-pod-target.js` raises outdated pod resource-bundle deployment targets to the app's existing iOS 15.1 minimum. Xcode 27 rejected the original 9.0/12.4/13.x targets. The plugin preserves higher targets and survives regeneration; do not fix this by hand-editing generated Pods.

The global Xcode selection still points to Command Line Tools. The `DEVELOPER_DIR` variable above selects full Xcode for this project without requiring a system-wide change.

The generated `ios/.xcode.env.local` initially referenced `/usr/local/bin/node`, which is absent on this Mac. It now points to `/opt/homebrew/opt/node@22/bin/node`. If moving machines again, verify this ignored file rather than copying an absolute Node path from the previous computer.

In this Xcode installation, the simulator UI is **Device Hub**, available from Xcode > Open Developer Tool > Device Hub. `simctl` works normally, but `open -a Simulator` does not find a standalone Simulator app.

The Homebrew AWS CLI initially had a native `awscrt` library mismatch. Its isolated environment was repaired with the matching upstream `awscrt` 0.37.0 binary wheel. A future Homebrew upgrade may replace that environment. AWS authentication uses temporary CLI login credentials under profile `budget-buddy`:

```sh
aws login --profile budget-buddy --region us-east-2
aws sts get-caller-identity --profile budget-buddy
```

Do not copy passwords or secret values into project files or this report. Before routine deployments, configure an appropriately scoped AWS identity; the inspected login was the account root identity.

## What the current app does

| Area | Implemented today | Difference from the meeting guide |
| --- | --- | --- |
| Stack | Expo 54, React Native 0.81.5, React 19, TypeScript; Go 1.26.6 toolchain; PostgreSQL 16 | Older ASP.NET architecture artwork is stale |
| Login | Email/password, verification/reset, onboarding | Apple sign-in for testers is not implemented |
| Today / budgeting | Category budgets, spending summaries, a daily budget of monthly category total / 30, fallback $80 | No income-cycle safe-to-spend engine or frozen morning baseline |
| Bank sync | Native Plaid Link, encrypted tokens, cursor sync, signed webhooks and durable retry worker | Pending spending, relink, freshness, and sync correctness need more work |
| Goals | Goals/contributions and Plaid savings reconciliation | No idempotent virtual allocation of yesterday's underspend |
| Score | Five pillars, starting at 280, with quests and tiers | Guide calls for a different 14-day score starting at 250 |
| Bud | Screen responds with canned delayed text; Today insights use deterministic SQL | No backend Anthropic chat integration |
| Notifications | Preferences, device tokens, inbox and local testing | No overnight refresh plus local 7:30 a.m. safe-to-spend notification pipeline |
| Navigation | Today, Budget, Bud, Quests, Goals; social prototype hidden | Guide calls for Today, Spending, Bud, Goals |

## AWS: verified live status

Region `us-east-2`, stack `budget-buddy-pilot`, account ending `0237`.

| Component | Observation |
| --- | --- |
| CloudFormation | `CREATE_COMPLETE`, created September 20 |
| EC2 | Running `t3.micro`, instance `i-09f610d343528349e` |
| Elastic IP | `18.227.252.62` |
| ECR | Repository `budget-buddy-pilot` contains image tag `pilot-20260920-1` |
| Runtime configuration | SSM SecureString `/budget-buddy/pilot/runtime` exists; required database/auth/Plaid encryption and SMTP secret fields are present |
| Host deployment | `/opt/budget-buddy` contains only `bootstrap.ready`; no application deployment files, Docker images, or containers |
| Host listeners | Docker service active, but no application listeners on 80, 443, or 8080 |
| API hostname | `api.budgetbudd.com` did not resolve during review; HTTPS endpoint could not be reached |
| DNS hosting | No Route 53 hosted zones in this account; registrar or external DNS access remains to be identified |
| Plaid environment | Runtime is **sandbox**, even though `APP_ENV=production` |
| OAuth / AI | Plaid redirect URI absent; Anthropic API key absent |

The pilot is designed as a single EC2 host with API, PostgreSQL, and Caddy containers, not managed RDS. Existing `compose.aws.yml`, `infra/aws/stack.yml`, and `infra/aws/deploy.sh` are the intended deployment path. Existing free-plan guard checks must be rerun at deployment time because account status, credits, and expiration can change.

**Next AWS work:** verify domain ownership/DNS provider; review the intended image and runtime settings; prepare a deployment bundle; deploy the approved revision; point the A record at the Elastic IP; verify HTTPS, migrations, readiness, auth and signed webhook delivery. Add a database backup schedule, prove restore works, and set operational/cost alerts before collecting tester data. Treat the existing image as an old candidate, not proof that current source or the beta features are deployed.

## Plaid: implemented foundation, remaining beta gaps

The local configuration successfully created a real Plaid **sandbox Link token**. This verifies configured sandbox credentials and API connectivity. It does not verify a complete bank-link transaction import, OAuth return on iPhone, production access, or webhook delivery from the public internet.

Existing code includes AES-GCM access-token encryption, `/transactions/sync` additions/modifications/removals, ES256 webhook verification including body hash and time checks, duplicate webhook handling, and a persisted retry worker. Older documents marking all webhook verification as unfinished are stale.

Before real testers:

1. Make a complete multi-page sync atomic and restart from its original cursor on `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION`. Current code persists each page and cursor independently. Serialize syncs per Item and surface partial failures.
2. Implement Link update mode and persisted Item error/reconnect state. Current webhook processing focuses on transaction events and does not establish a complete relink workflow.
3. Include pending transactions in the beta ledger, reconcile pending-to-posted transitions and removals, and match manual entries without double counting. Preserve the data required for that matching.
4. Expose last successful sync and an understandable stale/error state to Today and Spending.
5. Configure and exercise production OAuth return URLs, public signed webhooks, consent/unlink flows and deletion. Verify that repeated balance calls and enabled products match the account's intended billing/access.
6. Confirm the Plaid dashboard entitlement. The PDF describes a 10-connection trial for 8 testers; this account-specific allowance was **not verified**. Sandbox credentials cannot connect real tester banks.
7. Review the currently locked React Native Plaid SDK 12.8.2 against the supported upgrade path and test on physical iPhones before changing its major version. Pod installation emits a deprecation notice; do not infer that all of Link is absent or that a blind upgrade is safe.

References: [Plaid sync migration and pagination](https://plaid.com/docs/transactions/sync-migration/), [Link update mode](https://plaid.com/docs/link/update-mode/), [React Native Link](https://plaid.com/docs/link/react-native/).

## Implement the meeting guide in this order

Before distributing to testers, update the mobile framework for iOS 27 scene support and review dependency advisories together. The backend engine work below can proceed independently while the current app is tested on iOS 26. Verify the new framework on physical devices before using it for the pilot.

### 1. Specify and test the money engine

Create integer-cent calculations and persisted cycle inputs before redesigning Today. Reference example: `(1400 - 620 - 115 - 140 - 297) / 6 = $38/day`. Inputs must first be normalized to the same time period. Use the earliest next income arrival, conservative income rules, prorated fixed bills/goals, and the 10% income buffer. Round the daily display down to whole dollars and bills/goals up as specified; clamp the displayed allowance at zero while retaining the underlying deficit for correct subsequent calculations.

Persist user timezone, source cadence/arrival dates, declarations, transaction classification, daily snapshots, and calculation version. Include pending purchases; exclude own transfers, credit-card payments, savings transfers and declared bills; handle refunds and applicable incoming reimbursements without making spending negative. Support no-bank manual spending immediately and retain cash entry after linking.

Test mixed income cadences, first partial cycle, zero available money, missed-payday one-day cycles, local midnight and DST, pending-to-posted replacement, duplicate/reordered webhooks, refunds, and manual/bank matching. Match each manual entry to at most one bank transaction within the agreed amount/date window.

Keep the morning allowance distinct from today's live remaining amount. Simply dividing again after each purchase would spread that purchase over remaining cycle days and misstate what can still be spent today. Define yesterday's underspend allocation so it cannot be moved to a goal twice or counted as both goal money and future spending money.

### 2. Build onboarding, Today, Spending and Goals on that engine

Four onboarding steps collect income sources, next arrival, fixed bills, and one goal. Support a zero goal contribution. The suggested goal amount and $15 daily allowance rule need an explicit insufficient-income fallback; reducing the goal to zero cannot create money that does not exist.

Build the large remaining-today value, neutral progress ring, yesterday action, freshness display, seven-day history, goal progress, and smaller score. Spending is read-only bank history plus the specified manual-expense action. Remove quests/levels and the old category-limit UI from beta navigation.

### 3. Harden Plaid and finish hosted operation

AWS DNS/deployment preparation can proceed alongside engine work. Complete the Plaid correctness cases above before real-bank data drives the spending number. Use an isolated sandbox check before consuming a limited real connection.

### 4. Add Bud, score, notifications and measurement

Give backend Anthropic Haiku only the exact engine payload needed to explain the number; keep arithmetic in code, keys server-side, cache responses, enforce the guide's 20-message daily limit, and configure the spending cap. Bud's current canned reply must be replaced.

Implement the new 14-day BuddyScore starting at 250 with the guide's weights and zero-goal alternative. Schedule overnight sync and one 7:30 a.m. local notification that uses the same daily snapshot as Today. Define event schema early and instrument each feature as it is built: app open, goal move, number explanation, score tap, incorrect-number report, and missed payday.

### 5. Prepare distribution and run the eight-person pilot

Complete Apple Developer enrollment and the chosen tester authentication path, then provision a signed TestFlight build pointing to HTTPS. Verify real iPhone launch, Plaid OAuth/relink, background refresh, notification timing, offline/stale states, account deletion, and a full pay-cycle calculation before inviting all eight testers.

Resolve the guide's measurement ambiguity before launch: it mentions both the first seven days and days 2-7, and says four metrics while listing five ordinary events. A reasonable proposal is to instrument every event and evaluate the before-noon habit over days 2-7, but this is a proposed decision rather than an established requirement.

## Verification and limits

- `npm ci`, TypeScript typecheck, Expo Doctor (18/18), iOS prebuild, CocoaPods install, and iOS JavaScript export completed.
- Go tests, race checks and vet passed with `GOTOOLCHAIN=go1.26.6`; `govulncheck` reported no reachable vulnerabilities (it noted four in required modules that were not called).
- AWS guard tests passed. Goal reconciliation idempotency passed against the real local PostgreSQL database.
- Local readiness, registration/login/profile, budget/goals responses and Plaid sandbox Link-token creation passed. The temporary smoke-test account was deleted.
- Native simulator compilation: see the final build status below. A bundle export alone does not prove native compilation or physical-device operation.
- Npm audit reported 52 advisories (33 high, 18 moderate, 1 low, no critical). These need a dependency-path and runtime-exposure review before beta. No force upgrade was applied; existing security notes are older than this audit. Raw local report: `.cache/audit-2026-10-03.json`.

Preserved the transferred source changes and backup. Set repository-local `core.filemode=false` to suppress 229 transfer-induced permission-only changes. Setup additions are `.env.local` (ignored), `.nvmrc`, `Brewfile`, the double-click starter, iOS pod-target and Personal Team plugins with app configuration entries, this report, and a README link to it. No commit or push was made.

### Native build status

The Debug simulator build **passed** with Xcode 27 after correcting pod resource-bundle deployment targets and the local Node path. It compiled both arm64 and x86_64 simulator architectures. The final build uses normal ad-hoc simulator signing (`CODE_SIGN_IDENTITY=-`); do not disable signing, because SecureStore needs the simulated application entitlement. Final build log: `.cache/native-signed-build.log`; app: `.cache/DerivedData/Build/Products/Debug-iphonesimulator/BudgetBuddy.app`.

The first full native compile took approximately 17 minutes. The signed app was installed and **visually verified at the welcome screen on iOS 26**, without the missing-Keychain-entitlement error seen in the initial unsigned attempt. Metro serves the bundle and the local backend remains healthy. This verifies native compilation and initial launch, including loading the installed Plaid module; it is not a complete Plaid Link flow, a signed physical-iPhone build, or a TestFlight archive.

**iOS 27 launch fails:** actual simulator launch stopped in UIKit with `UIScene life cycle is required for apps built with this SDK`. This is separate from the corrected compilation errors. The current Expo 54 template uses the old AppDelegate window lifecycle. See [Apple's lifecycle requirement](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle) and [Expo's migration guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md). Expo documents opt-in scene support on SDK 57 and default support on SDK 58; this is not a one-setting fix on SDK 54.

The official iOS 26.0 simulator runtime is installed, with a dedicated **Budget Buddy iOS 26** device (`EF52FDD6-8E64-4C2A-AC66-C02CCB4371AF`). Before beta, plan a deliberate Expo/React Native upgrade with scene lifecycle support and regression tests for Plaid deep links, notification taps, authentication and app foreground/background behavior. A successful iOS 26 launch would not establish iOS 27 compatibility.
