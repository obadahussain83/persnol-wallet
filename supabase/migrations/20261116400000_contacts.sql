-- Clients and suppliers. Debts and cheques can point at a contact, which gives each contact a statement.
create table public.contacts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  kind text not null default 'client' check (kind in ('client', 'supplier')),
  phone text check (length(phone) <= 30),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index contacts_user on public.contacts (user_id);
create trigger stamp before insert or update on public.contacts for each row execute function public.stamp_row();
alter table public.contacts enable row level security;
create policy own_rows on public.contacts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Deleting a contact keeps its debts and cheques, just unlinked.
alter table public.debts add column contact_id uuid references public.contacts (id) on delete set null;
alter table public.cheques add column contact_id uuid references public.contacts (id) on delete set null;

alter publication powersync add table public.contacts;
