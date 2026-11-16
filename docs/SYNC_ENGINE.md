# Sync engine

PowerSync client + Supabase. Code: `src/db/*`, `src/sync/supabase-connector.ts`, `powersync/sync-rules.yaml`.

## Write path (every financial operation)

1. Validate input (Zod, Phase 1) and parse money to minor units (`parseAmount`).
2. Generate a UUID locally (`uuid()` in SQL or `crypto.randomUUID()`).
3. `db.execute(...)` writes to local SQLite. PowerSync records the op in its `ps_crud` queue **in the same local transaction**.
4. Reactive queries re-run; the UI updates. No network involved.
5. When a session exists, PowerSync calls `uploadData()`, which sends the next queued transaction to Supabase.
6. On success → `tx.complete()` removes it from the queue. On error → the op stays queued and is retried. Nothing is discarded.
7. Server changes stream back through the user's bucket and are applied locally.

## Requirement → mechanism

| Requirement | Mechanism | Status |
|---|---|---|
| Works offline, survives restart | Local SQLite + persistent `ps_crud` queue | ✅ web verified (reload) |
| Idempotent writes / no duplicates | Client UUIDs; PUT = `INSERT … ON CONFLICT DO NOTHING` | ✅ DB test |
| Retry | PowerSync retries failed uploads (fixed delay, configurable `retryDelayMs`). Exponential backoff: wrap in connector, Phase 3 | ⚠️ |
| Incremental sync, server revisions | PowerSync checkpoints; `version` bumped by trigger | ✅ trigger tested |
| Soft deletes / tombstones | `deleted_at` on transactions; queries filter it | ✅ ledger test |
| Sync on foreground / restart | PowerSync reconnects automatically | to verify on device |
| Status: pending/syncing/synced/failed/conflict | `useStatus()` today (offline/syncing/synced); per-row pending from `ps_crud`; failed/conflict need Phase 3 tables | ⚠️ partial |
| Multi-device | Per-user bucket in sync rules | needs cloud setup |

## Conflict strategy (Phase 3)

Never blind last-write-wins on financial fields.

- **Inserts** never conflict (unique client UUIDs).
- **Updates** carry the `version` the client last saw. A Postgres `BEFORE UPDATE` check compares it with the current version:
  - equal → apply, bump version;
  - different, and the changed fields don't overlap (e.g. notes vs. amount) → merge;
  - different and overlapping on money/account/date/type → reject the write and store both versions in `sync_conflicts` (synced to the device). The user picks one in a Conflict screen.
- `transaction_revisions` keeps every prior version (trigger) for audit.
- **Deletes** are soft (`deleted_at`) so they propagate like any update and can be undone.
- A permanently rejected op (validation/RLS error) moves to a local `failed_ops` table so it can't block the queue; the UI shows it as Failed.

## Recurring transactions (Phase 5)

Each occurrence gets a **deterministic id** = UUIDv5(rule_id + occurrence date). Two devices generating the same occurrence offline produce the same id, so the second insert is a no-op. No duplicates, testable as a pure function.

## Logout / account switch (built in Phase 1)

- Sign-out disconnects and closes the DB but **keeps the file and its upload queue**; if anything is pending the user sees the count first. The queue uploads on that user's next sign-in on the device.
- One local database file per user id (`wallet-<userId>.sqlite`), opened in `SessionProvider` when the session's user changes. A second user on the same device never sees the first user's data.
- Offline start: `getSession()` reads stored credentials, so a signed-in user opens the app without network.
- Profiles are never inserted by the client in cloud mode (the server creates them at signup); inserting would be rejected by RLS and block the queue.

## Cloud setup (needs your accounts)

1. Create a Supabase project (free). Copy URL + anon key into `.env`.
2. Apply `supabase/migrations/*.sql` (SQL editor, or `npx supabase db push`). They already create the `powersync` publication, so skip PowerSync's sample `CREATE PUBLICATION`; only its `powersync_role` and `GRANT SELECT` steps are needed.
3. Create a PowerSync Cloud instance (free), connect it to the Supabase database, enable Supabase JWT auth, paste `powersync/sync-rules.yaml` into Sync Streams (edition 3). Copy the instance URL into `.env`.
4. Restart `npm run web`, sign in (auth UI arrives in Phase 1), and run the offline scenario in TESTING.md.
