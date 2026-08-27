drop index if exists plaid_webhook_events_verification_hash_idx;

alter table plaid_webhook_events
  drop column if exists plaid_issued_at,
  drop column if exists verification_hash;
