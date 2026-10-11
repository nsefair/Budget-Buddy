-- Beta events: the five interactions the launch guide measures, one row per
-- open or tap. Results are read with a fixed read-only query, never a public
-- endpoint.
create table app_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references users(id) on delete cascade,
 kind text not null check (kind in ('app_open','number_tap','goal_move_tap','score_tap','number_report')),
 detail jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index app_events_user_time on app_events(user_id, created_at);
