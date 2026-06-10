create table plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plaid_item_id text not null unique,
  institution_id text,
  institution_name text not null default '',
  access_token_ciphertext text not null,
  products text[] not null default '{}',
  consented_products text[] not null default '{}',
  available_products text[] not null default '{}',
  billed_products text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'relink_required', 'error', 'archived')),
  transactions_cursor text not null default '',
  last_sync_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index plaid_items_user_id_idx on plaid_items(user_id, created_at desc);
create index plaid_items_status_idx on plaid_items(status) where archived_at is null;

create table plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references plaid_items(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null default '',
  official_name text,
  mask text,
  type text not null default '',
  subtype text not null default '',
  verification_status text,
  current_balance_cents bigint,
  available_balance_cents bigint,
  iso_currency_code text,
  unofficial_currency_code text,
  is_active boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plaid_accounts_user_id_idx on plaid_accounts(user_id);
create index plaid_accounts_item_id_idx on plaid_accounts(item_id);

create table plaid_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  item_id uuid not null references plaid_items(id) on delete cascade,
  account_id uuid references plaid_accounts(id) on delete set null,
  plaid_transaction_id text not null unique,
  amount_cents bigint not null,
  iso_currency_code text,
  unofficial_currency_code text,
  date date not null,
  authorized_date date,
  name text not null,
  merchant_name text,
  category text[] not null default '{}',
  personal_finance_category_primary text,
  personal_finance_category_detailed text,
  pending boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plaid_transactions_user_date_idx on plaid_transactions(user_id, date desc);
create index plaid_transactions_account_date_idx on plaid_transactions(account_id, date desc);

create table plaid_webhook_events (
  id uuid primary key default gen_random_uuid(),
  plaid_item_id text,
  webhook_type text not null default '',
  webhook_code text not null default '',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index plaid_webhook_events_item_idx on plaid_webhook_events(plaid_item_id, created_at desc);
create index plaid_webhook_events_unprocessed_idx on plaid_webhook_events(created_at desc) where processed_at is null;

create trigger plaid_items_set_updated_at
before update on plaid_items
for each row execute function set_updated_at();

create trigger plaid_accounts_set_updated_at
before update on plaid_accounts
for each row execute function set_updated_at();

create trigger plaid_transactions_set_updated_at
before update on plaid_transactions
for each row execute function set_updated_at();
