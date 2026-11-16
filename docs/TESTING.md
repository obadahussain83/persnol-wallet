# Testing

Run everything: `npm test` (Node's built-in test runner; no Docker).

| Suite | File | Covers |
|---|---|---|
| Money | `src/lib/money.test.ts` | parsing per currency (ILS/USD 2dp, JOD 3dp), precision rejection, no float drift, exact conversion + rounding, formatting |
| Ledger SQL | `src/db/queries.test.ts` | account balances incl. same- and cross-currency transfers, soft deletes; period totals exclude transfers |
| Migration + RLS | `supabase/tests/rls.test.ts` | real migration in PGlite: isolation, server-owned user_id, cross-user FK, transfer constraints, version bump, idempotent retry |

| Repositories | `src/data/data.test.ts` | account validation + minor units, currency lock, archive; category nesting/kind/archive cascade/delete-if-unused/rename; local seeding; default list matches migration. Runs against tables generated from the app's `AppSchema` |

Migration + RLS suite also covers (Phase 1): signup seeds profile + 21 categories; profile isolation; clients can't create profiles.

Result after Phase 1: **23/23 pass**. After Phase 2 start: **27/27** (adds `src/data/transactions.test.ts`: balances, month totals, transfers excluded, validation, soft delete; Arabic digits in `money.test.ts`). `npx tsc --noEmit`: 0 errors.

## Manual checks done (web, Phase 1, local-only mode)

- Create account: JOD rejects `1.2345`, accepts `1250.5` → shown as `1,250.500`.
- Create subcategory "Groceries" under Food; shown nested.
- Arabic: RTL layout, translated UI, Arabic number/currency format; light theme.
- Mobile width: bottom tabs (Home, Accounts, More).
- Archive account via confirmation dialog → hidden from dashboard.

## Manual checks done (web, Phase 0)

- Local write updates UI instantly; balance derived from ledger (−₪100.00 after 2×50).
- Data survives page reload (IndexedDB).

## Offline scenario (run after cloud setup, Phase 3 acceptance)

1. Open the app online, signed in. 2. Go offline. 3. Add several transactions. 4. Edit one. 5. Close and reopen. 6. Data still there. 7. Go online. 8. Queue drains (status Synced). 9. Open a second device/browser. 10. Changes appear.

Also: two devices editing the same transaction, interrupted upload, duplicate upload, token expiry, logout with pending ops, transfers offline.

## Planned

- Component tests: jest-expo + React Native Testing Library (Phase 1).
- E2E web: Playwright against the SPA (Phase 3), including offline via network emulation.
- Native E2E: Maestro (Phase 6).
