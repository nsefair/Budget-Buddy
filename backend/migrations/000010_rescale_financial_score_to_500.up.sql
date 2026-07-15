-- Re-scale the Financial Health Score from 300–850 (credit-score-like) to 1–500.
-- Linear map: new = round((old - 300) / 550 * 499) + 1, clamped to [1, 500].

-- ── users ─────────────────────────────────────────────────────────────────────
alter table users
  alter column financial_health_score set default 250;

update users
   set financial_health_score = greatest(1, least(500,
         round((greatest(300, least(850, financial_health_score)) - 300)::numeric / 550 * 499)::integer + 1));

-- ── financial_health_profiles ────────────────────────────────────────────────
alter table financial_health_profiles
  drop constraint if exists financial_health_profiles_score_check,
  drop constraint if exists financial_health_profiles_previous_score_check;

update financial_health_profiles
   set score = greatest(1, least(500, round((greatest(300, least(850, score)) - 300)::numeric / 550 * 499)::integer + 1)),
       previous_score = greatest(1, least(500, round((greatest(300, least(850, previous_score)) - 300)::numeric / 550 * 499)::integer + 1));

update financial_health_profiles
   set score_band = case
         when score >= 435 then 'Exceptional'
         when score >= 360 then 'Thriving'
         when score >= 270 then 'Strong'
         when score >= 180 then 'Steady'
         else 'Foundation'
       end;

alter table financial_health_profiles
  alter column score set default 250,
  alter column previous_score set default 250,
  add constraint financial_health_profiles_score_check check (score between 1 and 500),
  add constraint financial_health_profiles_previous_score_check check (previous_score between 1 and 500);

-- ── quest_templates ──────────────────────────────────────────────────────────
alter table quest_templates
  drop constraint if exists quest_templates_minimum_score_check,
  drop constraint if exists quest_templates_maximum_score_check;

update quest_templates
   set minimum_score = greatest(1, least(500, round((greatest(300, least(850, minimum_score)) - 300)::numeric / 550 * 499)::integer + 1)),
       maximum_score = greatest(1, least(500, round((greatest(300, least(850, maximum_score)) - 300)::numeric / 550 * 499)::integer + 1));

alter table quest_templates
  alter column minimum_score set default 1,
  alter column maximum_score set default 500,
  add constraint quest_templates_minimum_score_check check (minimum_score between 1 and 500),
  add constraint quest_templates_maximum_score_check check (maximum_score between 1 and 500);

-- ── financial_score_events ───────────────────────────────────────────────────
alter table financial_score_events
  drop constraint if exists financial_score_events_previous_score_check,
  drop constraint if exists financial_score_events_new_score_check;

update financial_score_events
   set previous_score = greatest(1, least(500, round((greatest(300, least(850, previous_score)) - 300)::numeric / 550 * 499)::integer + 1)),
       new_score = greatest(1, least(500, round((greatest(300, least(850, new_score)) - 300)::numeric / 550 * 499)::integer + 1));

alter table financial_score_events
  add constraint financial_score_events_previous_score_check check (previous_score between 1 and 500),
  add constraint financial_score_events_new_score_check check (new_score between 1 and 500);
