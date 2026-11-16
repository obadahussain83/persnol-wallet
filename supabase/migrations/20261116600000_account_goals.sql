-- Optional savings goal on an account: progress is the account balance against goal_minor (same currency).
alter table public.accounts
  add column goal_minor bigint check (goal_minor > 0),
  add column goal_date date;
