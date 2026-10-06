alter table plaid_transactions add column pending_transaction_id text;
create index plaid_transactions_pending_identity_idx on plaid_transactions(user_id, pending_transaction_id) where pending_transaction_id is not null;
