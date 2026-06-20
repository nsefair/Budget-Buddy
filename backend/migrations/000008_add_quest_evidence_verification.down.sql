alter table user_weekly_quests
  drop column if exists verification_description,
  drop column if exists verification_type;

alter table quest_templates
  drop column if exists verification_description,
  drop column if exists verification_type;
