create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  first_name text not null,
  last_name text not null default '',
  avatar_url text,
  level integer not null default 1,
  xp integer not null default 0,
  xp_to_next_level integer not null default 200,
  streak integer not null default 0,
  streak_best_ever integer not null default 0,
  net_worth_cents bigint not null default 0,
  financial_health_score integer not null default 0,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium', 'elite')),
  onboarding_complete boolean not null default false,
  why text not null default '',
  why_icon text not null default 'sparkles',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_idx on users (lower(email));

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index refresh_tokens_user_id_idx on refresh_tokens(user_id);
create unique index refresh_tokens_token_hash_idx on refresh_tokens(token_hash);

create table onboarding_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  age_range text,
  life_situation text,
  goal_kinds text[] not null default '{}',
  custom_goal_label text,
  why text,
  why_icon text,
  first_goal jsonb,
  first_quest jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  kind text not null
    check (kind in (
      'emergency_fund',
      'debt_payoff',
      'savings_target',
      'invest',
      'income_growth',
      'stop_overspending',
      'custom'
    )),
  duration text not null check (duration in ('short', 'medium', 'long')),
  reason text not null default '',
  target_amount_cents bigint not null check (target_amount_cents >= 0),
  already_saved_cents bigint not null default 0 check (already_saved_cents >= 0),
  monthly_commit_cents bigint not null default 0 check (monthly_commit_cents >= 0),
  deadline timestamptz not null,
  linked_account_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on goals(user_id);
create index goals_user_active_idx on goals(user_id, deadline) where archived_at is null;

create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),
  source text not null default 'manual' check (source in ('manual', 'plaid', 'system')),
  transaction_id uuid,
  contributed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index goal_contributions_goal_id_idx on goal_contributions(goal_id, contributed_at desc);
create index goal_contributions_user_id_idx on goal_contributions(user_id, contributed_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

create trigger onboarding_profiles_set_updated_at
before update on onboarding_profiles
for each row execute function set_updated_at();

create trigger goals_set_updated_at
before update on goals
for each row execute function set_updated_at();
