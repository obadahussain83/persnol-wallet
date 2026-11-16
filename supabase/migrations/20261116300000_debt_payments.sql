-- Debts gain an optional due date and phone (for WhatsApp reminders), and can be paid back in parts.
-- Remaining = amount_minor - sum(debt_payments.amount_minor); the app settles the debt when it reaches zero.
alter table public.debts
  add column due_date date,
  add column phone text check (length(phone) <= 30);

create table public.debt_payments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  paid_at timestamptz not null,
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index debt_payments_user on public.debt_payments (user_id);
create index debt_payments_debt on public.debt_payments (debt_id);
create trigger stamp before insert or update on public.debt_payments for each row execute function public.stamp_row();
alter table public.debt_payments enable row level security;
create policy own_rows on public.debt_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.debt_payments;
