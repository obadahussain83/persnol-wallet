# Database schema

Source of truth: `supabase/migrations/`. Local mirror: `src/db/schema.ts` (keep both in sync).

## Phase 0 tables

| Table | Key columns | Notes |
|---|---|---|
| `accounts` | name, type, currency, opening_balance_minor, archived_at | `unique (id, user_id)` so children can FK on both |
| `categories` | name, kind (income/expense), parent_id | subcategories via parent_id; archived, never hard-deleted while used |
| `transactions` | type, account_id, amount_minor, currency, to_account_id, to_amount_minor, exchange_rate, category_id, occurred_at, deleted_at | one row per event; transfer = one row |

Common columns on every table: `id uuid` (client-generated), `user_id`, `created_at`, `updated_at`, `version`.

## Phase 1 additions

| Change | Notes |
|---|---|
| `profiles` (id = user id) | display_name, primary_currency. Created only by the signup trigger; clients may read/update their own row |
| `accounts.description` | ≤ 500 chars |
| `categories.key` | stable id of a built-in category (e.g. `food`) so the UI can translate it; cleared when the user renames it |
| `handle_new_user()` trigger | on `auth.users` insert: creates the profile and 21 default categories. `src/data/default-categories.ts` mirrors the list; a test fails if they drift |

## Phase 2 additions

| Change | Notes |
|---|---|
| `transactions.scope` | `personal` (default) or `work`; transfers are always personal. Work profit = work income − work expenses (`SCOPE_TOTALS_SQL`). Rows from before the column existed read as personal |

## Rules enforced in the app (repositories, `src/data/`)

- An account's currency can't change once it has transactions.
- Categories nest one level; a parent must be an active top-level category of the same kind; kind is fixed after creation.
- Archiving a category archives its subcategories; restoring a subcategory restores its parent.
- A category can be deleted only if no transaction or subcategory uses it (the server FK blocks it too).

## Rules enforced by the database

- Amounts are `bigint` minor units, `amount_minor > 0`; the type decides the sign.
- Transfer ⇔ `to_account_id` and `to_amount_minor` both set; source ≠ destination; no category.
- Composite FKs `(account_id, user_id)`: a transaction can only reference the same user's accounts and categories.
- `stamp_row` trigger: server sets `user_id = auth.uid()`, bumps `version`, sets timestamps.
- RLS on every table: `user_id = auth.uid()` for select/insert/update/delete.

## Ledger math

```
balance(account) = opening_balance_minor
                 + Σ income   on account
                 − Σ expense  on account
                 − Σ transfer out (amount_minor)
                 + Σ transfer in  (to_amount_minor)
                 (deleted_at IS NULL only)
```
Implemented once in `src/db/queries.ts`. Income/expense reports filter by type, so transfers never count as either.

## Planned (Phase 1+)

profiles, user_preferences, tags, transaction_tags, budgets, budget_categories, savings_goals, savings_contributions, recurring_transactions, debt_payments, exchange_rates, attachments, transaction_revisions, sync_conflicts, audit_logs.

Design notes already decided:
- Savings contributions and debt payments that move money are **linked transactions** (transfer or expense/income), so cash is counted once.
- Exchange rate is stored on the transaction as a decimal; old rows are never re-rated.
