-- Non-destructive rollback: keep lifted local test scores intact.

alter table users
  alter column financial_health_score set default 280;

alter table financial_health_profiles
  alter column score set default 280,
  alter column previous_score set default 280;
