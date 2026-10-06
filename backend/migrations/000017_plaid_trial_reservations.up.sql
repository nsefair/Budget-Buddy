-- Reserve a lifetime trial slot before opening Link. Do not auto-expire slots:
-- a user may have completed Link without the device finishing token exchange.
create table plaid_trial_reservations (
 user_id uuid primary key references users(id) on delete cascade,
 created_at timestamptz not null default now()
);
