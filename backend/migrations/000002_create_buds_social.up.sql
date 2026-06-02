create table bud_follows (
  follower_id uuid not null references users(id) on delete cascade,
  following_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index bud_follows_following_id_idx on bud_follows(following_id);

create table buds_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null
    check (type in (
      'quest_complete',
      'goal_milestone',
      'level_up',
      'streak_milestone',
      'badge_earned',
      'week_review'
    )),
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index buds_posts_feed_idx on buds_posts(created_at desc) where deleted_at is null;
create index buds_posts_user_id_idx on buds_posts(user_id, created_at desc) where deleted_at is null;

create table buds_fist_bumps (
  post_id uuid not null references buds_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index buds_fist_bumps_user_id_idx on buds_fist_bumps(user_id);
