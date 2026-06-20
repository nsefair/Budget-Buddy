alter table users
  alter column financial_health_score set default 500;

update users
   set financial_health_score = 500
 where financial_health_score = 0;

create table financial_health_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  score integer not null default 500 check (score between 300 and 850),
  previous_score integer not null default 500 check (previous_score between 300 and 850),
  score_band text not null default 'Steady',
  quest_consistency numeric(5, 2) not null default 50 check (quest_consistency between 0 and 100),
  budget_consistency numeric(5, 2) not null default 50 check (budget_consistency between 0 and 100),
  savings_momentum numeric(5, 2) not null default 50 check (savings_momentum between 0 and 100),
  goal_progress numeric(5, 2) not null default 50 check (goal_progress between 0 and 100),
  engagement_consistency numeric(5, 2) not null default 50 check (engagement_consistency between 0 and 100),
  recalculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into financial_health_profiles (user_id, score, previous_score, score_band)
select id,
       greatest(300, least(850, financial_health_score)),
       greatest(300, least(850, financial_health_score)),
       case
         when financial_health_score >= 780 then 'Exceptional'
         when financial_health_score >= 700 then 'Thriving'
         when financial_health_score >= 600 then 'Strong'
         when financial_health_score >= 500 then 'Steady'
         else 'Foundation'
       end
  from users
on conflict (user_id) do nothing;

create table quest_templates (
  id text primary key,
  cadence text not null default 'weekly' check (cadence = 'weekly'),
  category text not null check (category in ('spending', 'saving', 'planning', 'awareness', 'goals', 'consistency')),
  title text not null,
  instructions text not null,
  check_in_label text not null,
  icon_name text not null,
  target_value integer not null check (target_value > 0),
  unit text not null,
  xp_reward integer not null check (xp_reward between 50 and 200),
  score_impact integer not null check (score_impact between 1 and 25),
  minimum_score integer not null default 300 check (minimum_score between 300 and 850),
  maximum_score integer not null default 850 check (maximum_score between 300 and 850),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (minimum_score <= maximum_score)
);

insert into quest_templates (
  id, category, title, instructions, check_in_label, icon_name,
  target_value, unit, xp_reward, score_impact, minimum_score, maximum_score
) values
  ('home_meals_3', 'spending', 'Cook 3 meals at home', 'Check in after a meal you made at home. One check-in counts each day.', 'Meal cooked', 'home', 3, 'meals', 120, 10, 300, 850),
  ('pack_lunch_3', 'spending', 'Pack lunch 3 times', 'Check in on each day you bring lunch instead of buying it.', 'Lunch packed', 'wallet', 3, 'lunches', 110, 9, 300, 720),
  ('planned_spend_5', 'planning', 'Keep surprise spending at zero for 5 days', 'At the end of a day when every purchase was planned, add one check-in.', 'Day stayed planned', 'shield-check', 5, 'days', 180, 15, 300, 850),
  ('no_buy_days_2', 'spending', 'Take 2 no-buy days', 'Add a check-in after a full day with no optional purchases.', 'No-buy day done', 'calendar', 2, 'days', 100, 8, 300, 700),
  ('review_transactions_5', 'awareness', 'Review 5 recent purchases', 'Open your transaction list, check the category, then log each review here.', 'Purchase reviewed', 'receipt', 5, 'reviews', 90, 7, 300, 620),
  ('budget_check_3', 'consistency', 'Check your budget 3 times', 'Take a quick look at your budget on three different days this week.', 'Budget checked', 'bar-chart', 3, 'checks', 90, 7, 300, 680),
  ('subscription_scan', 'awareness', 'Scan your recurring charges', 'Review recurring charges once and confirm that every one still belongs.', 'Scan complete', 'search', 1, 'scan', 80, 6, 300, 650),
  ('goal_move', 'goals', 'Make one move toward a goal', 'Open a goal and record any contribution that fits this week.', 'Goal move made', 'target', 1, 'move', 130, 11, 300, 850),
  ('save_twice', 'saving', 'Choose savings twice this week', 'Log two moments when you moved money to savings or skipped an unplanned purchase for your goal.', 'Savings choice made', 'piggy-bank', 2, 'choices', 140, 12, 380, 850),
  ('grocery_plan', 'planning', 'Plan one grocery trip', 'Make a short list before one grocery trip and check in when the trip is done.', 'Trip planned', 'check-circle', 1, 'trip', 75, 6, 300, 650),
  ('delivery_free_4', 'spending', 'Go 4 days without delivery', 'Check in at the end of each delivery-free day.', 'Delivery-free day', 'home', 4, 'days', 150, 12, 420, 850),
  ('pause_purchase_3', 'planning', 'Pause before 3 optional buys', 'Give an optional purchase ten minutes, then log the pause whether you buy it or not.', 'Pause taken', 'activity', 3, 'pauses', 120, 9, 450, 850),
  ('money_minute_5', 'consistency', 'Take a 1-minute money check 5 days', 'Open Budget Buddy, glance at your plan, and check in. Keep it to one minute.', 'Minute complete', 'zap', 5, 'days', 170, 14, 300, 850),
  ('category_reset', 'planning', 'Set one category limit', 'Choose the spending category that needs the clearest boundary this week and set its limit.', 'Limit set', 'layers', 1, 'limit', 100, 8, 300, 620),
  ('goal_reason', 'goals', 'Reconnect with your goal', 'Open your main goal and read the reason you wrote for it before your next purchase.', 'Reason revisited', 'sparkles', 1, 'review', 70, 5, 300, 850),
  ('week_ahead', 'planning', 'Name 3 purchases before they happen', 'Write down three purchases you expect this week, then check in for each one.', 'Purchase planned', 'calendar', 3, 'purchases', 105, 8, 480, 850),
  ('account_check_2', 'awareness', 'Check your balances twice', 'Look at your linked account balances on two different days. Awareness is the whole task.', 'Balance checked', 'wallet', 2, 'checks', 80, 6, 300, 650),
  ('extra_goal_move', 'saving', 'Give your top goal one extra move', 'Add a small contribution beyond the pace you already planned.', 'Extra move made', 'trending-up', 1, 'move', 180, 15, 620, 850);

create table user_weekly_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  template_id text not null references quest_templates(id),
  week_start date not null,
  title text not null,
  why_it_matters text not null,
  instructions text not null,
  check_in_label text not null,
  icon_name text not null,
  category text not null,
  progress integer not null default 0 check (progress >= 0),
  target_value integer not null check (target_value > 0),
  unit text not null,
  xp_reward integer not null check (xp_reward > 0),
  score_impact integer not null check (score_impact > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'expired')), 
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start, template_id),
  check (progress <= target_value),
  check ((status = 'completed') = (completed_at is not null))
);

create index user_weekly_quests_user_week_idx
  on user_weekly_quests(user_id, week_start desc);
create index user_weekly_quests_active_idx
  on user_weekly_quests(user_id, expires_at)
  where status = 'active';

create table quest_check_ins (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references user_weekly_quests(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  check_in_date date not null,
  created_at timestamptz not null default now(),
  unique (quest_id, check_in_date)
);

create index quest_check_ins_user_date_idx
  on quest_check_ins(user_id, check_in_date desc);

create table financial_score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_type text not null,
  source_id text,
  previous_score integer not null check (previous_score between 300 and 850),
  new_score integer not null check (new_score between 300 and 850),
  delta integer generated always as (new_score - previous_score) stored,
  created_at timestamptz not null default now()
);

create index financial_score_events_user_created_idx
  on financial_score_events(user_id, created_at desc);

create trigger financial_health_profiles_set_updated_at
before update on financial_health_profiles
for each row execute function set_updated_at();

create trigger user_weekly_quests_set_updated_at
before update on user_weekly_quests
for each row execute function set_updated_at();

create or replace function sync_user_financial_health_score()
returns trigger as $$
begin
  update users
     set financial_health_score = new.score
   where id = new.user_id;
  return new;
end;
$$ language plpgsql;

create trigger financial_health_profiles_sync_user_score
after insert or update of score on financial_health_profiles
for each row execute function sync_user_financial_health_score();
