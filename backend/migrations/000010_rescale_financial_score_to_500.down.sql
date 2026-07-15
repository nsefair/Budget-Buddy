-- Revert the Financial Health Score to the 300–850 range.
-- Inverse map: old = round((new - 1) / 499 * 550) + 300, clamped to [300, 850].

alter table financial_score_events
  drop constraint if exists financial_score_events_previous_score_check,
  drop constraint if exists financial_score_events_new_score_check;

update financial_score_events
   set previous_score = greatest(300, least(850, round((greatest(1, least(500, previous_score)) - 1)::numeric / 499 * 550)::integer + 300)),
       new_score = greatest(300, least(850, round((greatest(1, least(500, new_score)) - 1)::numeric / 499 * 550)::integer + 300));

alter table financial_score_events
  add constraint financial_score_events_previous_score_check check (previous_score between 300 and 850),
  add constraint financial_score_events_new_score_check check (new_score between 300 and 850);

alter table quest_templates
  drop constraint if exists quest_templates_minimum_score_check,
  drop constraint if exists quest_templates_maximum_score_check;

update quest_templates
   set minimum_score = greatest(300, least(850, round((greatest(1, least(500, minimum_score)) - 1)::numeric / 499 * 550)::integer + 300)),
       maximum_score = greatest(300, least(850, round((greatest(1, least(500, maximum_score)) - 1)::numeric / 499 * 550)::integer + 300));

alter table quest_templates
  alter column minimum_score set default 300,
  alter column maximum_score set default 850,
  add constraint quest_templates_minimum_score_check check (minimum_score between 300 and 850),
  add constraint quest_templates_maximum_score_check check (maximum_score between 300 and 850);

alter table financial_health_profiles
  drop constraint if exists financial_health_profiles_score_check,
  drop constraint if exists financial_health_profiles_previous_score_check;

update financial_health_profiles
   set score = greatest(300, least(850, round((greatest(1, least(500, score)) - 1)::numeric / 499 * 550)::integer + 300)),
       previous_score = greatest(300, least(850, round((greatest(1, least(500, previous_score)) - 1)::numeric / 499 * 550)::integer + 300));

update financial_health_profiles
   set score_band = case
         when score >= 780 then 'Exceptional'
         when score >= 700 then 'Thriving'
         when score >= 600 then 'Strong'
         when score >= 500 then 'Steady'
         else 'Foundation'
       end;

alter table financial_health_profiles
  alter column score set default 500,
  alter column previous_score set default 500,
  add constraint financial_health_profiles_score_check check (score between 300 and 850),
  add constraint financial_health_profiles_previous_score_check check (previous_score between 300 and 850);

alter table users
  alter column financial_health_score set default 500;

update users
   set financial_health_score = greatest(300, least(850, round((greatest(1, least(500, financial_health_score)) - 1)::numeric / 499 * 550)::integer + 300));
