alter table quest_templates
  add column verification_type text not null default 'self_report'
    check (verification_type in (
      'self_report',
      'bank_no_spend',
      'bank_no_delivery',
      'goal_contribution',
      'budget_limit'
    )),
  add column verification_description text not null default 'Confirmed by your check-in.';

alter table user_weekly_quests
  add column verification_type text not null default 'self_report'
    check (verification_type in (
      'self_report',
      'bank_no_spend',
      'bank_no_delivery',
      'goal_contribution',
      'budget_limit'
    )),
  add column verification_description text not null default 'Confirmed by your check-in.';

update quest_templates
   set verification_type = 'bank_no_spend',
       verification_description = 'Verified from yesterday''s synced transactions.',
       check_in_label = 'Verify yesterday'
 where id in ('no_buy_days_2', 'planned_spend_5');

update quest_templates
   set verification_type = 'bank_no_delivery',
       verification_description = 'Verified from yesterday''s synced delivery activity.',
       check_in_label = 'Verify yesterday'
 where id = 'delivery_free_4';

update quest_templates
   set verification_type = 'goal_contribution',
       verification_description = 'Verified from a new contribution to one of your goals.',
       check_in_label = 'Verify contribution'
 where id in ('goal_move', 'save_twice', 'extra_goal_move');

update quest_templates
   set verification_type = 'budget_limit',
       verification_description = 'Verified from a category limit saved in Budget.',
       check_in_label = 'Verify limit'
 where id = 'category_reset';

update user_weekly_quests q
   set verification_type = t.verification_type,
       verification_description = t.verification_description,
       check_in_label = t.check_in_label
  from quest_templates t
 where t.id = q.template_id;

-- Do not strand an already-assigned user on a bank quest when no active bank
-- connection exists. Future assignment logic filters these templates out.
update user_weekly_quests q
   set verification_type = 'self_report',
       verification_description = 'Confirmed by your check-in.'
 where verification_type in ('bank_no_spend', 'bank_no_delivery')
   and not exists (
     select 1 from plaid_items i
      where i.user_id = q.user_id and i.status = 'active' and i.archived_at is null
   );
