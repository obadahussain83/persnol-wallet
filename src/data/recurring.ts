import { z } from 'zod';

import { dayKey, parseDay } from '../lib/dates.ts';
import { toDecimalString } from '../lib/money.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';
import { createTransaction, resolveTransaction, transactionInputSchema } from './transactions.ts';

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const recurringInputSchema = transactionInputSchema.omit({ occurredAt: true }).extend({
  frequency: z.enum(FREQUENCIES),
  startDate: z.string().refine((d) => parseDay(d) !== null, 'invalid'),
});
export type RecurringInput = z.input<typeof recurringInputSchema>;

export type RecurringRow = {
  id: string; type: 'income' | 'expense'; account_id: string; category_id: string; amount_minor: number; currency: string;
  scope: 'personal' | 'work'; note: string | null; frequency: Frequency; start_date: string; paused_at: string | null;
};

export async function createRecurring(db: Db, userId: string, input: RecurringInput): Promise<string> {
  const v = recurringInputSchema.parse(input);
  const { account, amount } = await resolveTransaction(db, { ...v, occurredAt: v.startDate });
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO recurring (id, user_id, type, account_id, category_id, amount_minor, currency, scope, note, frequency, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.type, account.id, v.categoryId, amount, account.currency, v.scope, v.note || null, v.frequency,
      dayKey(parseDay(v.startDate)!.toISOString()), now, now],
  );
  return id;
}

export async function setRecurringPaused(db: Db, id: string, paused: boolean): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE recurring SET paused_at = ?, updated_at = ? WHERE id = ?', [paused ? now : null, now, id]);
}

/** Stops future occurrences; transactions already created stay. */
export async function deleteRecurring(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM recurring WHERE id = ?', [id]);
}

/** Local calendar days from `start` through `until` (inclusive). Monthly/yearly keep the start's day, clamped to short months. */
export function occurrences(start: Date, frequency: Frequency, until: Date): Date[] {
  const out: Date[] = [];
  for (let i = 0; ; i++) {
    let d: Date;
    if (frequency === 'weekly') d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * i);
    else {
      const months = frequency === 'monthly' ? i : 12 * i;
      const y = start.getFullYear(), m = start.getMonth() + months;
      const last = new Date(y, m + 1, 0).getDate();
      d = new Date(y, m, Math.min(start.getDate(), last));
    }
    if (d > until) return out;
    out.push(d);
  }
}

/** Deterministic transaction id for one occurrence: the rule's id with its last group replaced by the date. */
export function occurrenceId(ruleId: string, day: Date): string {
  const ymd = dayKey(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString()).replaceAll('-', '');
  return `${ruleId.slice(0, 23)}-${ymd}0000`;
}

/**
 * Creates every due occurrence of every active rule up to `now` (idempotent: existing or deleted occurrences are skipped).
 * A rule whose account or category is no longer usable is skipped. Returns how many transactions were created.
 */
export async function generateDue(db: Db, userId: string, now = new Date()): Promise<number> {
  const rules = await db.getAll<RecurringRow>('SELECT * FROM recurring WHERE paused_at IS NULL');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let created = 0;
  for (const r of rules) {
    const start = parseDay(r.start_date);
    if (!start) continue;
    for (const day of occurrences(start, r.frequency, today)) {
      const id = occurrenceId(r.id, day);
      if (await db.getOptional('SELECT 1 AS x FROM transactions WHERE id = ?', [id])) continue;
      try {
        await createTransaction(db, userId, {
          type: r.type, accountId: r.account_id, categoryId: r.category_id, amount: toDecimalString(r.amount_minor, r.currency),
          occurredAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString(), note: r.note ?? '', scope: r.scope,
        }, id);
        created++;
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        break; // account archived/deleted or category changed: skip this rule until it is fixed
      }
    }
  }
  return created;
}

/** The first occurrence after `now`'s calendar day. */
export function nextOccurrence(start: Date, frequency: Frequency, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate() + 1); // every frequency recurs within a year
  return occurrences(start, frequency, horizon).find((d) => d > today)!;
}
