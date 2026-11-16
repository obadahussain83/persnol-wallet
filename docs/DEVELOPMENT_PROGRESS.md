# Development progress

## Phase 0 — Technical validation ✅

Expo SDK 58 + PowerSync (web verified) + Supabase migration/RLS tested in PGlite. See CHANGELOG 0.0.1.

## Phase 1 — Foundation

- [x] Migration 2: `profiles` (display name, primary currency), `accounts.description`, `categories.key`, signup trigger seeding 21 default categories — tested in PGlite
- [x] Repositories (`src/data/`) for accounts, categories, profile with Zod validation — tested against the real local schema
- [x] Rules: account currency locked once it has transactions; categories one level deep, same kind, kind fixed; archive cascades; delete only when unused
- [x] One local database per user (`wallet-<userId>.sqlite`); local-only mode when cloud isn't configured
- [x] Auth screens: sign in, sign up, forgot password, reset password (PKCE); protected routes via `Stack.Protected`
- [x] Sign-out keeps unsynced changes in the user's DB file and warns with the pending count
- [x] i18n English + Arabic, RTL (web: `dir`; native: `I18nManager`, applied on restart)
- [x] Light / dark / system theme, design tokens, shared components (Screen, Button, TextField, Card, EmptyState, Segmented, ChoiceGrid, ConfirmDialog, SyncStatus, AccountCard)
- [x] Responsive shell: sidebar ≥ 900 px, bottom tabs (Home, Accounts, More) below
- [x] Accounts: list with ledger balances, create/edit, archive/restore, show archived
- [x] Categories: expense/income, subcategories, create/edit/archive/restore/delete-if-unused, translated built-ins
- [x] Settings: profile, primary currency, language, theme, sync status, sign out
- [x] Verified in browser (local-only mode): create account with JOD 3-dp validation, subcategory, Arabic RTL + light theme, mobile bottom tabs, archive via dialog
- [x] **Android** — dev build made with EAS cloud build (profile `development`); installed on the emulator: app loads, native SQLite opens, account created (₪100.50) and still there after force-stop + relaunch
- [x] Local DB open failure shows an error screen with "Try again" instead of a blank page (verified in browser)
- [ ] **Sign-up / sign-in / reset against a live Supabase project** — needs your Supabase + PowerSync projects

## Phase 2 — Financial engine (started 2026-11-10, after competitor review)

- [x] Competitor comparison: docs/COMPETITOR_ANALYSIS.md
- [x] Transactions repository: expense, income, transfer (same and cross-currency), soft delete — tested
- [x] Quick-add screen (type → amount → category grid → save; today/yesterday; note)
- [x] Transactions list: day groups, search, delete
- [x] Dashboard: this month income / expenses / net, recent transactions
- [x] Navigation: Add button (sidebar + centre of bottom bar), Transactions tab
- [x] Arabic by default, Arabic app name, Arabic digits accepted in amounts
- [x] Simpler forms: narrow column; optional fields under "More options"; account type removed from the form
- [x] Personal vs work on every income/expense; dashboard shows personal (income, expenses, net) and work (income, expenses, work profit); transactions filter All / Personal / Work — tested
- [x] Faster entry: most-used categories first, last-used account preselected
- [ ] Edit an existing transaction, custom date picker, filters by account/category/amount, export
- [ ] Not checked visually in a browser by the agent this round (built-in browser cannot open the web DB); web bundle compiles, typecheck clean, 27 tests pass

## Known limitations / pending

- **Project location:** moved to `C:/dev/personal-wallet` (2026-11-10). In the old OneDrive path the Android build failed (Windows 260-char path limit in `node_modules/…/.cxx`, and OneDrive touching build files), and Metro missed files written during installs.
- **Android on Windows:** after the move, all native libraries compile, but React Native's generated C++ object paths reach 274–333 characters (safe-area-context, reanimated, screens, svg, gesture-handler), so no folder short enough exists. CMake 3.22's ninja 1.10 can't use long paths. Options: (a) enable Windows long paths (admin) + install CMake ≥ 3.30 (ninja 1.12) in the Android SDK and point the build at it; (b) build in the cloud with EAS (free tier, needs an Expo account); (c) build inside WSL.
- **In-app browser pane:** shared workers can't make network requests there, so PowerSync's web database can't open in that pane (the app now shows its error screen). Regular Chrome/Edge are unaffected; earlier web checks ran in the pane's dev-server preview mode.
- Changing language on **native** needs an app restart to flip layout direction (no `expo-updates` reload yet).
- Net worth across currencies needs exchange rates (Phase 4); the dashboard shows totals per currency.
- Supabase auth error messages are shown in English.
- Git: only the scaffold's "Initial commit"; all Phase 0–1 work is uncommitted.
- Upload retry uses PowerSync's fixed delay; exponential backoff + failed-ops table in Phase 3. Conflict detection is designed, not built (Phase 3).
