# Security

## In place (Phase 0)

- **RLS enabled on every user table** with `user_id = auth.uid()` for all operations. Tested in `supabase/tests/rls.test.ts` (another user can't read, update or delete; anonymous sees nothing).
- **Server-assigned ownership**: the `stamp_row` trigger overwrites `user_id` with `auth.uid()`. Tested.
- **Cross-user references blocked** by composite FKs. Tested.
- **Sync rules** send each user only their own rows.
- **No secrets in code**: only `EXPO_PUBLIC_*` URL + anon key in `.env` (gitignored). The service-role key is never used by the client.

## Added in Phase 1

- `profiles`: select/update own row only; no client insert/delete (created by a `security definer` signup trigger). Tested.
- One local DB file per user id; a second account on the same device never opens the first one's file.
- Sign-out keeps unsynced changes in that user's file and warns with the count; nothing is discarded.
- Password reset uses PKCE; "forgot password" shows the same message whether or not the email exists.

## Planned

- Storage bucket policies keyed on `auth.uid()` folder prefix (Phase 5, with attachments).
- Encrypted local DB on native (PowerSync supports SQLCipher) and optional app lock.
- An option to wipe a signed-out user's local data on shared devices (only when nothing is pending).
- Phase 6: security audit (Supabase advisors, dependency audit).

## Rules

- Never disable RLS, even in development.
- Never ship the service-role key in the app.
- Never send financial data to an external AI provider without explicit consent.
