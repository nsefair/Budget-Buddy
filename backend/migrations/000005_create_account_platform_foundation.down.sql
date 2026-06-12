drop trigger if exists subscription_entitlements_set_updated_at on subscription_entitlements;
drop trigger if exists notification_devices_set_updated_at on notification_devices;
drop trigger if exists notification_preferences_set_updated_at on notification_preferences;

drop table if exists billing_events;
drop table if exists subscription_entitlements;
drop table if exists notification_devices;
drop table if exists notifications;
drop table if exists notification_preferences;
drop table if exists auth_action_tokens;

alter table onboarding_profiles
  drop column if exists requested_plan_lifetime,
  drop column if exists requested_plan_cycle,
  drop column if exists requested_plan_tier;

alter table users
  drop column if exists email_verified_at;
