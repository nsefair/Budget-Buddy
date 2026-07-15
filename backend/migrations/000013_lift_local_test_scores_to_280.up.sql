-- Keep local pre-test accounts out of scary first-impression territory.
-- Existing dev rows from earlier score formulas can sit far below the new
-- calm 280/500 baseline unless we lift them once.

alter table users
  alter column financial_health_score set default 280;

alter table financial_health_profiles
  alter column score set default 280,
  alter column previous_score set default 280;

update users
   set financial_health_score = 280
 where financial_health_score < 280;

update financial_health_profiles
   set score = greatest(score, 280),
       previous_score = greatest(previous_score, 280),
       score_band = 'Strong'
 where score < 280
    or previous_score < 280;
