-- Debts in both directions: money people owe the user, and money the user owes people.
-- A debt is a standalone record (no ledger effect); settling it just stamps settled_at.
create table public.debts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  person text not null check (length(person) between 1 and 100),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  note text check (length(note) <= 500),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index debts_user on public.debts (user_id);
create trigger stamp before insert or update on public.debts for each row execute function public.stamp_row();
alter table public.debts enable row level security;
create policy own_rows on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.debts;
