-- Post-dated cheques, received (incoming) or written (outgoing). A cheque is a standalone record like a debt;
-- when it clears, the app offers to record the matching income/expense as a normal transaction.
create table public.cheques (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null check (direction in ('incoming', 'outgoing')),
  person text not null check (length(person) between 1 and 100),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  bank text check (length(bank) <= 100),
  number text check (length(number) <= 50),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'cleared', 'bounced')),
  status_at timestamptz,
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index cheques_user on public.cheques (user_id);
create trigger stamp before insert or update on public.cheques for each row execute function public.stamp_row();
alter table public.cheques enable row level security;
create policy own_rows on public.cheques for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.cheques;
