drop trigger if exists plaid_transactions_set_updated_at on plaid_transactions;
drop trigger if exists plaid_accounts_set_updated_at on plaid_accounts;
drop trigger if exists plaid_items_set_updated_at on plaid_items;

drop table if exists plaid_webhook_events;
drop table if exists plaid_transactions;
drop table if exists plaid_accounts;
drop table if exists plaid_items;
