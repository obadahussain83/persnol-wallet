-- Phase 1: profiles (incl. preferences), account description, built-in category keys, signup seeding.

-- During signup there is no JWT (auth.uid() is null); the security-definer seeding below supplies user_id.
-- Clients can never reach that path: RLS policies only admit `authenticated` with user_id = auth.uid().
create or replace function public.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := coalesce(auth.uid(), new.user_id);
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

alter table public.accounts add column description text check (length(description) <= 500);
-- Stable identifier for built-in categories so the UI can translate them; null for user-created ones.
alter table public.categories add column key text;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 100),
  primary_currency text not null default 'ILS' check (primary_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  check (id = user_id)
);

create trigger stamp before insert or update on public.profiles for each row execute function public.stamp_row();
alter table public.profiles enable row level security;
-- Profiles are created by the signup trigger only; clients may read and update their own.
create policy own_profile_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, user_id) values (new.id, new.id);
  insert into public.categories (id, user_id, key, name, kind, color, icon)
  select gen_random_uuid(), new.id, c.key, c.name, c.kind, c.color, c.icon
  from (values
    ('food', 'Food', 'expense', '#E07A5F', 'utensils'),
    ('restaurants', 'Restaurants', 'expense', '#D4644A', 'chef-hat'),
    ('transportation', 'Transportation', 'expense', '#3D85C6', 'bus'),
    ('fuel', 'Fuel', 'expense', '#5B6C8F', 'fuel'),
    ('shopping', 'Shopping', 'expense', '#C2185B', 'shopping-bag'),
    ('clothing', 'Clothing', 'expense', '#8E5BB5', 'shirt'),
    ('bills', 'Bills', 'expense', '#E0A030', 'receipt'),
    ('rent', 'Rent', 'expense', '#8D6E63', 'house'),
    ('healthcare', 'Healthcare', 'expense', '#D64545', 'heart-pulse'),
    ('entertainment', 'Entertainment', 'expense', '#7E57C2', 'clapperboard'),
    ('subscriptions', 'Subscriptions', 'expense', '#26A69A', 'repeat'),
    ('travel', 'Travel', 'expense', '#29B6F6', 'plane'),
    ('education', 'Education', 'expense', '#5C6BC0', 'graduation-cap'),
    ('personal', 'Personal expenses', 'expense', '#EC407A', 'user'),
    ('other_expense', 'Other', 'expense', '#78909C', 'circle-ellipsis'),
    ('salary', 'Salary', 'income', '#2E9E6A', 'briefcase'),
    ('freelance', 'Freelance', 'income', '#43A047', 'laptop'),
    ('business', 'Business', 'income', '#0F766E', 'building-2'),
    ('investments', 'Investments', 'income', '#00897B', 'trending-up'),
    ('gifts', 'Gifts', 'income', '#F06292', 'gift'),
    ('other_income', 'Other income', 'income', '#78909C', 'circle-plus')
  ) as c (key, name, kind, color, icon);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter publication powersync add table public.profiles;
