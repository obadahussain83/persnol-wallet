import { z } from 'zod';

import { dayKey, parseDay } from '../lib/dates.ts';
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
    dueDate: z.string().trim().refine((d) => !d || parseDay(d) !== null, 'invalidDate').default(''),
    phone: z.string().trim().max(30, 'tooLong').regex(/^[+\d\s-]*$/, 'invalidPhone').default(''),
    contactId: z.string().default(''),
  })
  .superRefine((v, ctx) => {
    try {
      if (parseAmount(v.amount, v.currency) <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amountPositive' });
    } catch {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'invalidAmount' });
    }
  });
export type DebtInput = z.input<typeof debtInputSchema>;

const dueDateOf = (d: string) => (d ? dayKey(parseDay(d)!.toISOString()) : null);

export async function createDebt(db: Db, userId: string, input: DebtInput): Promise<string> {
  const v = debtInputSchema.parse(input);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO debts (id, user_id, direction, person, amount_minor, currency, note, due_date, phone, contact_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.direction, v.person, parseAmount(v.amount, v.currency), v.currency, v.note || null,
      dueDateOf(v.dueDate), v.phone || null, v.contactId || null, now, now],
  );
  return id;
}

/** Sum already paid back on a debt, in minor units. */
export async function debtPaid(db: Db, debtId: string): Promise<number> {
  const r = await db.getOptional<{ paid: number | null }>('SELECT SUM(amount_minor) AS paid FROM debt_payments WHERE debt_id = ?', [debtId]);
  return r?.paid ?? 0;
}

export async function updateDebt(db: Db, id: string, input: DebtInput): Promise<void> {
  const v = debtInputSchema.parse(input);
  const current = await db.getOptional<{ currency: string }>('SELECT currency FROM debts WHERE id = ?', [id]);
  if (!current) throw new DomainError('notFound');
  const paid = await debtPaid(db, id);
  // Payments are recorded in the debt's currency, and the total can't drop below what was already repaid.
  if (paid > 0 && v.currency !== current.currency) throw new DomainError('currencyLocked');
  const amount = parseAmount(v.amount, v.currency);
  if (amount < paid) throw new DomainError('amountBelowPaid');
  await db.execute(
    'UPDATE debts SET direction = ?, person = ?, amount_minor = ?, currency = ?, note = ?, due_date = ?, phone = ?, contact_id = ?, updated_at = ? WHERE id = ?',
    [v.direction, v.person, amount, v.currency, v.note || null, dueDateOf(v.dueDate), v.phone || null, v.contactId || null, nowIso(), id],
  );
}

export async function setDebtSettled(db: Db, id: string, settled: boolean): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE debts SET settled_at = ?, updated_at = ? WHERE id = ?', [settled ? now : null, now, id]);
}

export async function deleteDebt(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM debt_payments WHERE debt_id = ?', [id]);
  await db.execute('DELETE FROM debts WHERE id = ?', [id]);
}

/** Records a repayment (at most what remains); settles the debt when nothing remains. */
export async function addDebtPayment(db: Db, userId: string, debtId: string, amount: string, paidAt: string): Promise<string> {
  const debt = await db.getOptional<{ amount_minor: number; currency: string }>('SELECT amount_minor, currency FROM debts WHERE id = ?', [debtId]);
  if (!debt) throw new DomainError('notFound');
  let minor: number;
  try {
    minor = parseAmount(amount, debt.currency);
  } catch {
    throw new DomainError('invalidAmount');
  }
  if (minor <= 0) throw new DomainError('amountPositive');
  const remaining = debt.amount_minor - (await debtPaid(db, debtId));
  if (minor > remaining) throw new DomainError('paymentTooLarge');
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    'INSERT INTO debt_payments (id, user_id, debt_id, amount_minor, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, debtId, minor, paidAt, now, now],
  );
  if (minor === remaining) await setDebtSettled(db, debtId, true);
  return id;
}

/** Removes a repayment; a debt that was settled reopens if something remains again. */
export async function deleteDebtPayment(db: Db, id: string): Promise<void> {
  const p = await db.getOptional<{ debt_id: string }>('SELECT debt_id FROM debt_payments WHERE id = ?', [id]);
  if (!p) return;
  await db.execute('DELETE FROM debt_payments WHERE id = ?', [id]);
  const d = await db.getOptional<{ amount_minor: number; settled_at: string | null }>('SELECT amount_minor, settled_at FROM debts WHERE id = ?', [p.debt_id]);
  if (d?.settled_at && d.amount_minor > (await debtPaid(db, p.debt_id))) await setDebtSettled(db, p.debt_id, false);
}

/** WhatsApp link with a prefilled message; without a usable number, WhatsApp lets the user pick the contact. */
export function whatsappUrl(phone: string | null, text: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // shortcut: a local number (leading 0) has no country code, so open the contact picker instead of guessing 970/972.
  if (digits.startsWith('0')) digits = '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
