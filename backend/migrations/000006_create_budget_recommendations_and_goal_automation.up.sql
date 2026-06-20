alter table goals
  add constraint goals_linked_account_id_fkey
  foreign key (linked_account_id) references plaid_accounts(id) on delete set null;

create unique index goals_active_linked_account_idx
  on goals(linked_account_id)
  where linked_account_id is not null and archived_at is null;

alter table goal_contributions
  add constraint goal_contributions_transaction_id_fkey
  foreign key (transaction_id) references plaid_transactions(id) on delete cascade;

create unique index goal_contributions_transaction_id_idx
  on goal_contributions(transaction_id)
  where transaction_id is not null;

create table budget_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_id text not null,
  bucket text not null check (bucket in ('needs', 'wants')),
  average_spend_cents bigint not null default 0 check (average_spend_cents >= 0),
  suggested_limit_cents bigint not null check (suggested_limit_cents >= 0),
  detected_monthly_income_cents bigint not null check (detected_monthly_income_cents > 0),
  lookback_start date not null,
  lookback_end date not null,
  source text not null default 'bud_recommended'
    check (source = 'bud_recommended'),
  generated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index budget_recommendations_user_generated_idx
  on budget_recommendations(user_id, generated_at desc);

create table budget_category_limits (
  user_id uuid not null references users(id) on delete cascade,
  category_id text not null,
  limit_cents bigint not null check (limit_cents >= 0),
  recommended_limit_cents bigint check (recommended_limit_cents >= 0),
  source text not null default 'user_adjusted'
    check (source in ('bud_recommended', 'user_adjusted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create trigger budget_category_limits_set_updated_at
before update on budget_category_limits
for each row execute function set_updated_at();

alter table plaid_webhook_events
  add column processing_started_at timestamptz,
  add column processing_attempts integer not null default 0,
  add column next_attempt_at timestamptz not null default now(),
  add column processing_error text;

create index plaid_webhook_events_ready_idx
  on plaid_webhook_events(next_attempt_at, created_at)
  where processed_at is null;
