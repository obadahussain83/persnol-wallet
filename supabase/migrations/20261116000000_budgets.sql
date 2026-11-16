-- Monthly spending limit per expense category and currency. Spending is derived from transactions;
-- a budget on a parent category also counts its subcategories.
create table public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index budgets_user on public.budgets (user_id);
create trigger stamp before insert or update on public.budgets for each row execute function public.stamp_row();
alter table public.budgets enable row level security;
create policy own_rows on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.budgets;
