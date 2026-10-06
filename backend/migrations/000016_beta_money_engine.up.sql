create table money_profiles (
 user_id uuid primary key references users(id) on delete cascade,
 profile jsonb not null,
 cycle jsonb not null,
 updated_at timestamptz not null default now()
);
create table money_manual_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references users(id) on delete cascade,
 client_id text not null,
 date date not null,
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=10000000000),
 merchant text not null default '',
 cash boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,client_id)
);
create table money_daily_snapshots (
 user_id uuid not null references users(id) on delete cascade,
 date date not null,
 timezone text not null,
 cycle_start date not null,
 version text not null,
 morning_cents bigint not null check(morning_cents>=0),
 morning_inputs jsonb not null,
 latest_result jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,date)
);
create table money_goal_allocations (
 user_id uuid not null references users(id) on delete cascade,
 date date not null,
 goal_id uuid references goals(id) on delete set null,
 amount_cents bigint not null check(amount_cents>0),
 created_at timestamptz not null default now(),
 primary key(user_id,date)
);
create table money_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references users(id) on delete cascade,
 kind text not null,
 local_date date not null,
 detail jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create unique index money_missed_payday_once on money_events(user_id,kind,(detail->>'cycleStart')) where kind='payday_missed';
