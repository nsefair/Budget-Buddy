alter table buds_posts
  drop constraint if exists buds_posts_type_check;

alter table buds_posts
  add constraint buds_posts_type_check
  check (type in (
    'quest_complete',
    'goal_milestone',
    'score_milestone',
    'league_progress',
    'level_up',
    'streak_milestone',
    'badge_earned',
    'week_review'
  ));

alter table buds_posts
  add column visibility text not null default 'buds'
    check (visibility in ('buds', 'private')),
  add column comments_enabled boolean not null default true,
  add column is_verified boolean not null default false,
  add column achievement_kind text
    check (achievement_kind is null or achievement_kind in ('quest', 'goal', 'score', 'league', 'badge')),
  add column achievement_ref_id text,
  add column achievement_label text;

create index buds_posts_visibility_feed_idx
  on buds_posts (visibility, created_at desc, id desc)
  where deleted_at is null;

create table buds_post_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  post_id uuid references buds_posts(id) on delete cascade,
  storage_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size between 1 and 8388608),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  position smallint not null default 0 check (position between 0 and 3),
  created_at timestamptz not null default now()
);

create index buds_post_media_post_position_idx
  on buds_post_media (post_id, position)
  where post_id is not null;

create unique index buds_post_media_unique_position_idx
  on buds_post_media (post_id, position)
  where post_id is not null;

create index buds_post_media_unattached_idx
  on buds_post_media (owner_id, created_at desc)
  where post_id is null;

create table buds_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references buds_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index buds_post_comments_post_created_idx
  on buds_post_comments (post_id, created_at asc, id asc)
  where deleted_at is null;

create index buds_post_comments_user_created_idx
  on buds_post_comments (user_id, created_at desc)
  where deleted_at is null;
