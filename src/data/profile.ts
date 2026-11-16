import { z } from 'zod';

import { CURRENCIES } from './accounts.ts';
import { type Db, nowIso } from './db.ts';
import { DEFAULT_CATEGORIES } from './default-categories.ts';

export const profileInputSchema = z.object({
  displayName: z.string().trim().max(100, 'tooLong'),
  primaryCurrency: z.enum(CURRENCIES),
});
export type ProfileInput = z.input<typeof profileInputSchema>;

export async function updateProfile(db: Db, userId: string, input: ProfileInput): Promise<void> {
  const v = profileInputSchema.parse(input);
  await db.execute('UPDATE profiles SET display_name = ?, primary_currency = ?, updated_at = ? WHERE id = ?', [
    v.displayName || null,
    v.primaryCurrency,
    nowIso(),
    userId,
  ]);
}

/**
 * Local-only (no cloud configured) mode has no signup trigger, so create the same starter data
 * locally. Never call this when syncing: profiles are server-created and inserts would be rejected.
 */
export async function seedLocalOnlyUser(db: Db, userId: string): Promise<void> {
  if (await db.getOptional('SELECT 1 AS x FROM profiles WHERE id = ?', [userId])) return;
  const now = nowIso();
  await db.execute(
    'INSERT INTO profiles (id, user_id, primary_currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [userId, userId, 'ILS', now, now],
  );
  for (const c of DEFAULT_CATEGORIES) {
    await db.execute(
      `INSERT INTO categories (id, user_id, key, name, kind, color, icon, created_at, updated_at)
       VALUES (uuid(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, c.key, c.name, c.kind, c.color, c.icon, now, now],
    );
  }
}
