import { z } from 'zod';

import { dayKey, parseDay } from '../lib/dates.ts';
import { parseAmount } from '../lib/money.ts';
import { CURRENCIES } from './accounts.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

// incoming: a cheque someone gave the user. outgoing: a cheque the user wrote.
export const CHEQUE_DIRECTIONS = ['incoming', 'outgoing'] as const;
export type ChequeDirection = (typeof CHEQUE_DIRECTIONS)[number];
export const CHEQUE_STATUSES = ['pending', 'cleared', 'bounced'] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

// Messages are i18n keys under `errors.`.
export const chequeInputSchema = z
  .object({
    direction: z.enum(CHEQUE_DIRECTIONS),
    person: z.string().trim().min(1, 'required').max(100, 'tooLong'),
    amount: z.string().trim(),
    currency: z.enum(CURRENCIES),
    bank: z.string().trim().max(100, 'tooLong'),
    number: z.string().trim().max(50, 'tooLong'),
    dueDate: z.string().refine((d) => parseDay(d) !== null, 'invalidDate'),
    note: z.string().trim().max(500, 'tooLong'),
    contactId: z.string().default(''),
  })
  .superRefine((v, ctx) => {
    try {
      if (parseAmount(v.amount, v.currency) <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amountPositive' });
    } catch {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'invalidAmount' });
    }
  });
export type ChequeInput = z.input<typeof chequeInputSchema>;

function toRow(input: ChequeInput) {
  const v = chequeInputSchema.parse(input);
  return [v.direction, v.person, parseAmount(v.amount, v.currency), v.currency, v.bank || null, v.number || null,
    dayKey(parseDay(v.dueDate)!.toISOString()), v.note || null, v.contactId || null];
}

export async function createCheque(db: Db, userId: string, input: ChequeInput): Promise<string> {
  const row = toRow(input);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO cheques (id, user_id, direction, person, amount_minor, currency, bank, number, due_date, note, contact_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, userId, ...row, now, now],
  );
  return id;
}

export async function updateCheque(db: Db, id: string, input: ChequeInput): Promise<void> {
  const row = toRow(input);
  if (!(await db.getOptional('SELECT 1 AS x FROM cheques WHERE id = ?', [id]))) throw new DomainError('notFound');
  await db.execute(
    `UPDATE cheques SET direction = ?, person = ?, amount_minor = ?, currency = ?, bank = ?, number = ?, due_date = ?, note = ?,
       contact_id = ?, updated_at = ? WHERE id = ?`,
    [...row, nowIso(), id],
  );
}

export async function setChequeStatus(db: Db, id: string, status: ChequeStatus): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE cheques SET status = ?, status_at = ?, updated_at = ? WHERE id = ?',
    [status, status === 'pending' ? null : now, now, id]);
}

export async function deleteCheque(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM cheques WHERE id = ?', [id]);
}

/** Pending cheques due within this many days are highlighted (list and dashboard). */
export const DUE_SOON_DAYS = 7;

/** Whole local days from today until `due` (negative when overdue). */
export function daysUntil(due: string, now = new Date()): number {
  const d = parseDay(due);
  if (!d) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
