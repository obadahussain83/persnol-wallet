-- Separate personal money from work money, so work profit (work income − work expenses) can be reported.
-- Transfers are always 'personal' (they move money between own accounts and never count as income/expense).
alter table public.transactions
  add column scope text not null default 'personal' check (scope in ('personal', 'work'));

create index transactions_user_scope_date on public.transactions (user_id, scope, occurred_at desc);
