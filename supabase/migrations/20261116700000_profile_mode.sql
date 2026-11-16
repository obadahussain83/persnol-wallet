-- How the user uses the app: 'personal' hides business tools (work scope, clients, invoices); 'business' shows all.
-- NULL = not chosen yet: the app asks once after signup. Existing users keep every feature they already had.
alter table public.profiles add column mode text check (mode in ('personal', 'business'));
update public.profiles set mode = 'business' where mode is null;
