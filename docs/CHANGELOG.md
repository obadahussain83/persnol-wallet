# Changelog

## 0.2.1 — 2026-11-10

- Personal / work on each transaction (migration `20261110100000_transaction_scope.sql`); work profit on the dashboard; scope filter in transactions.
- Quick add lists most-used categories first and preselects the last-used account. Tests: 29.

## 0.2.0 — 2026-11-10 (Phase 2 start)

- Record expenses, income and transfers (quick-add screen); transactions list with search and delete.
- Dashboard shows this month income/expenses/net and recent transactions.
- Arabic is the default language; Arabic digits accepted in amounts.
- Shorter, narrower forms; account type removed from the account form.
- Error screen with retry when the local database cannot open.
- Competitor analysis doc. Tests: 27.

## 0.1.0 — 2026-11-10 (Phase 1)

- Auth: sign in, sign up, forgot/reset password (PKCE), protected routes, safe sign-out.
- One local database per user; local-only mode without cloud config.
- Migration: profiles, account description, category keys, default categories seeded at signup.
- Repositories for accounts, categories and profile with Zod validation.
- Accounts, categories, settings and dashboard screens.
- Responsive navigation (sidebar / bottom tabs), English + Arabic with RTL, light/dark/system theme.
- Tests: 23 (adds repositories, signup seeding, profile RLS, category tree).
- Removed Expo template screens and components.

## 0.0.1 — 2026-11-09 (Phase 0)

- Expo SDK 58 project with Expo Router and TypeScript.
- PowerSync local database for native (quick-sqlite) and web (wa-sqlite in IndexedDB).
- Supabase client and PowerSync upload connector.
- Money module (integer minor units, exact conversion).
- Ledger balance and period-total queries.
- Supabase migration for accounts, categories, transactions with RLS.
- Tests: money, ledger SQL, migration + RLS (12).
- Project documentation.
