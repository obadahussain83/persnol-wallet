# Architecture

## Diagram

```
 ┌──────────────── Device (web / iOS / Android) ─────────────────┐
 │  UI (Expo Router screens, shared components)                   │
 │        │ reactive SQL queries (useQuery)      ▲                │
 │        ▼                                      │                │
 │  Domain logic  src/lib (money)  src/db/queries (ledger SQL)    │
 │        │ db.execute (local write, instant)                     │
 │        ▼                                                       │
 │  PowerSync client SDK                                          │
 │   ├─ local SQLite  (native: quick-sqlite | web: wa-sqlite+IDB) │
 │   └─ upload queue (ps_crud) ──► SupabaseConnector.uploadData   │
 └───────────────▲──────────────────────────────┬─────────────────┘
       sync stream (per-user bucket)            │ REST writes (JWT)
                 │                              ▼
 ┌───────────────┴──────────┐      ┌──────────────────────────────┐
 │ PowerSync Service        │◄─────│ Supabase Postgres            │
 │ (reads WAL through the   │ logical  tables + triggers + RLS    │
 │  `powersync` publication)│ replic.│ Supabase Auth (JWT)         │
 └──────────────────────────┘      │ Supabase Storage (receipts)  │
                                   └──────────────────────────────┘
```

Reads always hit local SQLite. Writes go to local SQLite first and are queued; the cloud is never on the critical path of the UI.

## Layers (folder = boundary)

| Folder | Responsibility | May import |
|---|---|---|
| `src/app` | Routes/screens only | everything below |
| `src/components` | Reusable UI | `lib`, `constants` |
| `src/lib` | Pure domain logic (money, dates). No React, no DB | nothing app-specific |
| `src/db` | Local schema, DB instance, shared SQL | `lib` |
| `src/sync` | Connector to the backend | `db`, `lib` |
| `supabase/` | Migrations + DB tests | — |
| `powersync/` | Sync rules | — |

## Decisions (ADRs)

**ADR-1 Expo SDK 58 + Expo Router + TypeScript.** One codebase for web/iOS/Android; file-based routing; `.web.ts` files for platform differences (only the DB factory so far).

**ADR-2 PowerSync for offline sync (validated on web).** Local SQLite on every platform, an upload queue that survives restarts, automatic reconnect, incremental per-user streams from Postgres. Writing our own engine would duplicate all of this. Fallback if it stops fitting: keep the local schema, replace connector + replication with a custom pull endpoint keyed on `version`.

**ADR-3 Money as integer minor units.** `bigint` in Postgres, `INTEGER` in SQLite, safe-integer-checked `number` in JS. Conversion uses `BigInt` with decimal-string rates. See `src/lib/money.ts`.

**ADR-4 Ledger model, no stored balances.** Balance = opening balance + signed sum of transactions, computed by one shared SQL query (`ACCOUNT_BALANCES_SQL`). Nothing can drift.

**ADR-5 Transfer = one row.** `account_id → to_account_id` with `amount_minor` and `to_amount_minor` (cross-currency capable). One row is atomic locally, in upload and on the server, so a half-applied transfer is impossible. Transfers are excluded from income/expense by type.

**ADR-6 Server owns identity and revisions.** A trigger sets `user_id = auth.uid()`, bumps `version`, sets timestamps. A client cannot write rows as another user.

**ADR-7 Web is an SPA.** `web.output = "single"`: a local IndexedDB database can't be server-rendered.

## Dependency compatibility assessment (checked 2026-11-09)

| Package | Version | Result |
|---|---|---|
| expo / expo-router | 58.0.23 / 58.0.30 | ✅ scaffolded, web runs |
| react-native / react / react-native-web | 0.88.1 / 19.3.0 / 0.21.4 | ✅ |
| @powersync/web | 1.39.2 | ✅ local writes, reactive queries, persistence across reload verified in a browser |
| @powersync/react-native + @journeyapps/react-native-quick-sqlite | 1.35.11 / 2.5.2 | ⚠️ installs, typechecks, config plugin added; **native run not yet verified** (needs a dev build) |
| @powersync/react | **1.10.0 (pinned)** | ⚠️ 2.x pulls `@powersync/common@2` while the web/RN SDKs use `common@1.58` → two copies, broken context. Stay on 1.x until the SDKs move |
| @supabase/supabase-js | 2.119.0 | ✅ typechecks; not yet run against a live project |
| @electric-sql/pglite (dev) | 0.5.16 | ✅ runs the migration + RLS tests |

Added in Phase 1 (via `npx expo install`): zod 4.6, react-hook-form 7.91 + @hookform/resolvers 7, i18next 27 + react-i18next 18, expo-localization, lucide-react-native 1.70 + react-native-svg 15.16. All run on web.

**ADR-8 Styling: StyleSheet + theme tokens, no NativeWind.** The template's token approach (`constants/theme.ts`, `useTheme`) covers light/dark and RTL (logical `marginStart`/`borderEndWidth`) without a build-time CSS pipeline. Fewer moving parts on three platforms.

**ADR-9 Repositories in `src/data/`.** Every write goes through a repository function taking a minimal `Db` interface, so the same code runs against PowerSync in the app and node:sqlite in tests. Repositories use relative `.ts` imports (no `@/`) so Node can run them directly.

**ADR-10 Preferences split.** Language and theme are device settings (AsyncStorage, needed before sign-in). Display name and primary currency are per-user and sync (`profiles`).

Native build finding (Phase 1): Android build fails in this location (Windows path length + OneDrive). See DEVELOPMENT_PROGRESS.

Added later, in the phase that needs them (via `npx expo install`): zod, react-hook-form, i18next, date-fns, charts, icons, styling. The chart library is picked in Phase 4 after a web check (Skia-based charts need CanvasKit wasm on web).

**Web problem found and fixed:** Metro can't bundle PowerSync's workers/wasm (the wasm request returned the HTML page). Fix: `powersync-web copy-assets` into `public/` on postinstall, and point `WASQLiteOpenFactory` / `sync.worker` at `/@powersync/worker/*.umd.js`.

## Estimated infrastructure cost (MVP)

| Service | Plan | Cost |
|---|---|---|
| Supabase | Free (≈500 MB DB, 1 GB storage, 50k MAU; pauses after ~1 week idle) | $0 |
| PowerSync Cloud | Free (limited sync volume/connections; deactivates when idle) | $0 |
| Web hosting (static SPA) | Netlify / Vercel / Cloudflare Pages free | $0 |
| EAS Build | Free tier (queued builds) | $0 |
| Apple Developer / Google Play | Only at store release | $99/yr / $25 once |

First paid step when free tiers are outgrown: Supabase Pro (~$25/mo), PowerSync Pro (~$49/mo). Prices and limits change; check the pricing pages before relying on them. No paid service is used today.

## Technical risks

1. **Native PowerSync not yet run** on a device. First Phase 1 task: Android dev build.
2. **Expo SDK churn** (58 is new). Pin versions, upgrade one SDK at a time with `expo-doctor`.
3. **@powersync/react version split** (above). Recheck on every PowerSync upgrade.
4. **Conflict handling is ours to build**: PowerSync applies server state; revision checks live in our connector + DB (see SYNC_ENGINE.md).
5. **Free tiers pause when idle**: fine for development, not for real users.
6. **Repo lives in OneDrive**: syncing `node_modules` is slow and can lock files mid-install. Move the repo outside OneDrive.
7. **Browser storage eviction**: request persistent storage on web and show sync status clearly.
