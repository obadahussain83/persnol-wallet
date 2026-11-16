-- Recurring income/expense rules. The app materializes each due occurrence as a normal transaction
-- whose id is derived from (rule id, date), so two devices generating the same occurrence collapse into one row.
create table public.recurring (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  scope text not null default 'personal' check (scope in ('personal', 'work')),
  note text check (length(note) <= 500),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index recurring_user on public.recurring (user_id);
create trigger stamp before insert or update on public.recurring for each row execute function public.stamp_row();
alter table public.recurring enable row level security;
create policy own_rows on public.recurring for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.recurring;
