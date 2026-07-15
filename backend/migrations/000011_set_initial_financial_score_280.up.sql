-- Calm demo/testing baseline: 280/500 reads as "good base, room to grow."

alter table users
  alter column financial_health_score set default 280;

alter table financial_health_profiles
  alter column score set default 280,
  alter column previous_score set default 280;

update users
   set financial_health_score = 280
 where financial_health_score = 250;

update financial_health_profiles
   set score = 280,
       score_band = 'Strong'
 where score = 250;

update financial_health_profiles
   set previous_score = 280
 where previous_score = 250;
