drop trigger if exists financial_health_profiles_sync_user_score on financial_health_profiles;
drop function if exists sync_user_financial_health_score();
drop trigger if exists user_weekly_quests_set_updated_at on user_weekly_quests;
drop trigger if exists financial_health_profiles_set_updated_at on financial_health_profiles;

drop table if exists financial_score_events;
drop table if exists quest_check_ins;
drop table if exists user_weekly_quests;
drop table if exists quest_templates;
drop table if exists financial_health_profiles;

alter table users
  alter column financial_health_score set default 0;
