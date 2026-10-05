# Budget Buddy working rules

- Preserve existing work. Read `docs/local-setup-and-beta-readiness.md` and the latest continuation note before claiming launch readiness.
- AWS must remain on the active **Free account plan**. Never upgrade to Paid, enable paid-only products, join AWS Organizations, create a Control Tower landing zone, or purchase subscriptions/contracts. The user authorizes free credits only and no unexpected card charges.
- Before any AWS deployment or provisioning, run `python3 infra/aws/guard.py --account 455012390237`. Stop if it fails. It requires the correct account, an active Free plan, at least $15 credit reserve, and more than seven days before expiry. Budget emails are notifications, not a spending cap. Do not disable the guard.
- Preserve private database networking. Admin user viewing uses the fixed read-only SSM query in `infra/aws/view-users.py`; do not expose PostgreSQL or create a public admin endpoint.
- Plaid is on a limited trial. Do not consume real Items for automated tests or upgrade its plan. Use sandbox for automated linking tests; a human must complete bank login and consent for real data.
- Do not put credentials, user directories, database dumps, or tokens in Git, screenshots, logs, or assistant messages. Local admin snapshots belong in ignored `.cache/admin/`.
- Distinguish the deployed money-engine API from mobile screen integration, and native compilation from verified runtime behavior.
