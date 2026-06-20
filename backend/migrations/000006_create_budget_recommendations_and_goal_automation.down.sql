drop index if exists plaid_webhook_events_ready_idx;

alter table plaid_webhook_events
  drop column if exists processing_error,
  drop column if exists next_attempt_at,
  drop column if exists processing_attempts,
  drop column if exists processing_started_at;

drop trigger if exists budget_category_limits_set_updated_at on budget_category_limits;
drop table if exists budget_category_limits;
drop table if exists budget_recommendations;

drop index if exists goal_contributions_transaction_id_idx;
alter table goal_contributions
  drop constraint if exists goal_contributions_transaction_id_fkey;

drop index if exists goals_active_linked_account_idx;
alter table goals
  drop constraint if exists goals_linked_account_id_fkey;
