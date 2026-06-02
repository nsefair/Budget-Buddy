drop trigger if exists goals_set_updated_at on goals;
drop trigger if exists onboarding_profiles_set_updated_at on onboarding_profiles;
drop trigger if exists users_set_updated_at on users;

drop function if exists set_updated_at();

drop table if exists goal_contributions;
drop table if exists goals;
drop table if exists onboarding_profiles;
drop table if exists refresh_tokens;
drop table if exists users;
