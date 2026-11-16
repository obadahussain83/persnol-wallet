import { z } from 'zod';

import { CURRENCY_DECIMALS, type CurrencyCode, parseAmount } from '../lib/money.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

export const ACCOUNT_TYPES = ['cash', 'bank', 'wallet', 'savings', 'other'] as const;
export const CURRENCIES = Object.keys(CURRENCY_DECIMALS) as [CurrencyCode, ...CurrencyCode[]];

// Messages are i18n keys under `errors.`.
export const accountInputSchema = z
  .object({
    name: z.string().trim().min(1, 'required').max(100, 'tooLong'),
    type: z.enum(ACCOUNT_TYPES),
    currency: z.enum(CURRENCIES),
    openingBalance: z.string().trim(),
    description: z.string().trim().max(500, 'tooLong'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid'),
    icon: z.string().min(1, 'required'),
  })
  .superRefine((v, ctx) => {
    try {
      parseAmount(v.openingBalance || '0', v.currency);
    } catch {
      ctx.addIssue({ code: 'custom', path: ['openingBalance'], message: 'invalidAmount' });
    }
  });

export type AccountInput = z.input<typeof accountInputSchema>;

function toRow(input: AccountInput) {
  const v = accountInputSchema.parse(input);
  return {
    name: v.name,
    type: v.type,
    currency: v.currency,
    opening: parseAmount(v.openingBalance || '0', v.currency),
    description: v.description || null,
    color: v.color,
    icon: v.icon,
  };
}

export async function createAccount(db: Db, userId: string, input: AccountInput): Promise<string> {
  const r = toRow(input);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO accounts (id, user_id, name, type, currency, opening_balance_minor, description, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, r.name, r.type, r.currency, r.opening, r.description, r.color, r.icon, now, now],
  );
  return id;
}

export async function updateAccount(db: Db, id: string, input: AccountInput): Promise<void> {
  const r = toRow(input);
  const current = await db.getOptional<{ currency: string }>('SELECT currency FROM accounts WHERE id = ?', [id]);
  if (!current) throw new DomainError('notFound');
  if (current.currency !== r.currency && (await accountHasTransactions(db, id))) {
    // Changing currency would reinterpret every historical amount.
    throw new DomainError('currencyLocked');
  }
  await db.execute(
    `UPDATE accounts SET name = ?, type = ?, currency = ?, opening_balance_minor = ?, description = ?,
       color = ?, icon = ?, updated_at = ? WHERE id = ?`,
    [r.name, r.type, r.currency, r.opening, r.description, r.color, r.icon, nowIso(), id],
  );
}

export async function setAccountArchived(db: Db, id: string, archived: boolean): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now : null, now, id]);
}

export async function accountHasTransactions(db: Db, id: string): Promise<boolean> {
  const row = await db.getOptional(
    'SELECT 1 AS x FROM transactions WHERE account_id = ? OR to_account_id = ? LIMIT 1',
    [id, id],
  );
  return row !== null;
}
