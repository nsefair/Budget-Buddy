drop table if exists buds_post_comments;
drop table if exists buds_post_media;

drop index if exists buds_posts_visibility_feed_idx;

alter table buds_posts
  drop column if exists achievement_label,
  drop column if exists achievement_ref_id,
  drop column if exists achievement_kind,
  drop column if exists is_verified,
  drop column if exists comments_enabled,
  drop column if exists visibility;

alter table buds_posts
  drop constraint if exists buds_posts_type_check;

alter table buds_posts
  add constraint buds_posts_type_check
  check (type in (
    'quest_complete',
    'goal_milestone',
    'level_up',
    'streak_milestone',
    'badge_earned',
    'week_review'
  ));
