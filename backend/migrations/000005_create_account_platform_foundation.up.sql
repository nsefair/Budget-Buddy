alter table users
  add column email_verified_at timestamptz;

alter table onboarding_profiles
  add column requested_plan_tier text not null default 'free'
    check (requested_plan_tier in ('free', 'premium', 'elite')),
  add column requested_plan_cycle text not null default 'monthly'
    check (requested_plan_cycle in ('monthly', 'annual')),
  add column requested_plan_lifetime boolean not null default false;

create table auth_action_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null
    check (purpose in ('password_reset', 'email_verification', 'email_change')),
  pending_email text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (purpose = 'email_change' and pending_email is not null)
    or (purpose <> 'email_change' and pending_email is null)
  )
);

create index auth_action_tokens_user_purpose_idx
  on auth_action_tokens(user_id, purpose, created_at desc);
create index auth_action_tokens_active_idx
  on auth_action_tokens(expires_at)
  where consumed_at is null;

create table notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  streak_enabled boolean not null default true,
  quests_enabled boolean not null default true,
  weekly_enabled boolean not null default true,
  buds_enabled boolean not null default true,
  bills_enabled boolean not null default true,
  smart_enabled boolean not null default false,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  timezone text not null default 'America/New_York',
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on notifications(user_id, created_at desc);
create index notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;

create table notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('expo', 'apns', 'fcm')),
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  app_version text not null default '',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_devices_user_idx
  on notification_devices(user_id, enabled);

create table subscription_entitlements (
  user_id uuid primary key references users(id) on delete cascade,
  tier text not null default 'free'
    check (tier in ('free', 'premium', 'elite')),
  status text not null default 'inactive'
    check (status in ('inactive', 'trialing', 'active', 'grace_period', 'expired', 'revoked')),
  provider text not null default 'none'
    check (provider in ('none', 'apple', 'google', 'revenuecat', 'manual')),
  product_id text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  environment text not null default 'sandbox'
    check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscription_provider_id_idx
  on subscription_entitlements(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null default '',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index billing_events_unprocessed_idx
  on billing_events(created_at)
  where processed_at is null;

create trigger notification_preferences_set_updated_at
before update on notification_preferences
for each row execute function set_updated_at();

create trigger notification_devices_set_updated_at
before update on notification_devices
for each row execute function set_updated_at();

create trigger subscription_entitlements_set_updated_at
before update on subscription_entitlements
for each row execute function set_updated_at();

