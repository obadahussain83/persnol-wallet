-- Phase 0 core ledger tables. Extended (tags, budgets, goals, ...) in Phase 1+.
-- Money: bigint minor units. IDs: client-generated UUIDs (idempotent offline inserts).

-- Server owns user_id, version and timestamps; whatever the client sends for them is ignored.
create function public.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.version := 1;
    new.created_at := coalesce(new.created_at, now());
  else
    new.user_id := old.user_id;
    new.version := old.version + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create table public.accounts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  type text not null check (type in ('cash', 'bank', 'wallet', 'savings', 'other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  opening_balance_minor bigint not null default 0,
  color text,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (id, user_id)
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  kind text not null check (kind in ('income', 'expense')),
  parent_id uuid,
  color text,
  icon text,
  archived_at timestamptz, -- categories are archived, never hard-deleted while referenced
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.categories (id, user_id)
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  account_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  to_account_id uuid,
  to_amount_minor bigint check (to_amount_minor > 0),
  exchange_rate numeric check (exchange_rate > 0),
  category_id uuid,
  occurred_at timestamptz not null,
  description text,
  merchant text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  -- composite FKs: a row can only reference the SAME user's accounts/categories
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (to_account_id, user_id) references public.accounts (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),
  constraint transfer_shape check (
    (type = 'transfer') = (to_account_id is not null and to_amount_minor is not null)
  ),
  constraint transfer_distinct check (to_account_id is distinct from account_id),
  constraint transfer_no_category check (type <> 'transfer' or category_id is null)
);

create index transactions_user_date on public.transactions (user_id, occurred_at desc);
create index transactions_account on public.transactions (account_id);
create index transactions_to_account on public.transactions (to_account_id) where to_account_id is not null;
create index transactions_category on public.transactions (category_id) where category_id is not null;
create index accounts_user on public.accounts (user_id);
create index categories_user on public.categories (user_id);

create trigger stamp before insert or update on public.accounts for each row execute function public.stamp_row();
create trigger stamp before insert or update on public.categories for each row execute function public.stamp_row();
create trigger stamp before insert or update on public.transactions for each row execute function public.stamp_row();

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy own_rows on public.accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- PowerSync replicates from this logical-replication publication.
create publication powersync for table public.accounts, public.categories, public.transactions;
