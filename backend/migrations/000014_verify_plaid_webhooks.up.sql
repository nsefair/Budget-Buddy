alter table plaid_webhook_events
  add column verification_hash text,
  add column plaid_issued_at timestamptz;

create unique index plaid_webhook_events_verification_hash_idx
  on plaid_webhook_events(verification_hash)
  where verification_hash is not null;
