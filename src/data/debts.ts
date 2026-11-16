import { z } from 'zod';

import { parseAmount } from '../lib/money.ts';
import { CURRENCIES } from './accounts.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

// owed_to_me: someone owes the user. i_owe: the user owes someone.
export const DEBT_DIRECTIONS = ['owed_to_me', 'i_owe'] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const debtInputSchema = z
  .object({
    direction: z.enum(DEBT_DIRECTIONS),
    person: z.string().trim().min(1, 'required').max(100, 'tooLong'),
    amount: z.string().trim(),
    currency: z.enum(CURRENCIES),
    note: z.string().trim().max(500, 'tooLong'),
  })
  .superRefine((v, ctx) => {
    try {
      if (parseAmount(v.amount, v.currency) <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amountPositive' });
    } catch {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'invalidAmount' });
    }
  });
export type DebtInput = z.input<typeof debtInputSchema>;

export async function createDebt(db: Db, userId: string, input: DebtInput): Promise<string> {
  const v = debtInputSchema.parse(input);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO debts (id, user_id, direction, person, amount_minor, currency, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.direction, v.person, parseAmount(v.amount, v.currency), v.currency, v.note || null, now, now],
  );
  return id;
}

export async function updateDebt(db: Db, id: string, input: DebtInput): Promise<void> {
  const v = debtInputSchema.parse(input);
  if (!(await db.getOptional('SELECT 1 AS x FROM debts WHERE id = ?', [id]))) throw new DomainError('notFound');
  await db.execute(
    'UPDATE debts SET direction = ?, person = ?, amount_minor = ?, currency = ?, note = ?, updated_at = ? WHERE id = ?',
    [v.direction, v.person, parseAmount(v.amount, v.currency), v.currency, v.note || null, nowIso(), id],
  );
}

export async function setDebtSettled(db: Db, id: string, settled: boolean): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE debts SET settled_at = ?, updated_at = ? WHERE id = ?', [settled ? now : null, now, id]);
}

export async function deleteDebt(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM debts WHERE id = ?', [id]);
}
