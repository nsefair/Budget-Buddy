create table bud_blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index bud_blocks_blocked_id_idx on bud_blocks(blocked_id);

create table bud_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_user_id uuid references users(id) on delete set null,
  post_id uuid references buds_posts(id) on delete set null,
  reason text not null default 'other',
  details text not null default '',
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or post_id is not null)
);

create index bud_reports_status_created_idx on bud_reports(status, created_at desc);
create index bud_reports_reporter_id_idx on bud_reports(reporter_id, created_at desc);
create index bud_reports_reported_user_id_idx on bud_reports(reported_user_id, created_at desc);
create index bud_reports_post_id_idx on bud_reports(post_id, created_at desc);
