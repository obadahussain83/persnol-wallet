-- Invoices and quotes. Line items are stored as JSON text ([{description, quantity, unit_price_minor}]);
-- the total is derived from them. Marking one paid lets the app record the income as a normal transaction.
create table public.invoices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice', 'quote')),
  number text not null check (length(number) between 1 and 30),
  contact_id uuid references public.contacts (id) on delete set null,
  client_name text not null check (length(client_name) between 1 and 100),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issue_date date not null,
  due_date date,
  items text not null,
  total_minor bigint not null check (total_minor >= 0),
  note text check (length(note) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index invoices_user on public.invoices (user_id);
create trigger stamp before insert or update on public.invoices for each row execute function public.stamp_row();
alter table public.invoices enable row level security;
create policy own_rows on public.invoices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication powersync add table public.invoices;
