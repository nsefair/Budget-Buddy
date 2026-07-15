alter table users
  alter column financial_health_score set default 250;

alter table financial_health_profiles
  alter column score set default 250,
  alter column previous_score set default 250;

update users
   set financial_health_score = 250
 where financial_health_score = 280;

update financial_health_profiles
   set score = 250,
       score_band = 'Steady'
 where score = 280;

update financial_health_profiles
   set previous_score = 250
 where previous_score = 280;
