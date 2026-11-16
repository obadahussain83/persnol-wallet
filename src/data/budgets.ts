import { z } from 'zod';

import { parseAmount } from '../lib/money.ts';
import { CURRENCIES } from './accounts.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

// Messages are i18n keys under `errors.`.
export const budgetInputSchema = z
  .object({
    categoryId: z.string().min(1, 'chooseCategory'),
    amount: z.string().trim(),
    currency: z.enum(CURRENCIES),
  })
  .superRefine((v, ctx) => {
    try {
      if (parseAmount(v.amount, v.currency) <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amountPositive' });
    } catch {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'invalidAmount' });
    }
  });
export type BudgetInput = z.input<typeof budgetInputSchema>;

/** One budget per category and currency; `exceptId` skips the budget being edited. */
async function assertUnique(db: Db, categoryId: string, currency: string, exceptId: string | null) {
  const dup = await db.getOptional(
    'SELECT 1 AS x FROM budgets WHERE category_id = ? AND currency = ? AND id IS NOT ?',
    [categoryId, currency, exceptId],
  );
  if (dup) throw new DomainError('budgetExists');
}

export async function createBudget(db: Db, userId: string, input: BudgetInput): Promise<string> {
  const v = budgetInputSchema.parse(input);
  await assertUnique(db, v.categoryId, v.currency, null);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO budgets (id, user_id, category_id, amount_minor, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.categoryId, parseAmount(v.amount, v.currency), v.currency, now, now],
  );
  return id;
}

export async function updateBudget(db: Db, id: string, input: BudgetInput): Promise<void> {
  const v = budgetInputSchema.parse(input);
  if (!(await db.getOptional('SELECT 1 AS x FROM budgets WHERE id = ?', [id]))) throw new DomainError('notFound');
  await assertUnique(db, v.categoryId, v.currency, id);
  await db.execute(
    'UPDATE budgets SET category_id = ?, amount_minor = ?, currency = ?, updated_at = ? WHERE id = ?',
    [v.categoryId, parseAmount(v.amount, v.currency), v.currency, nowIso(), id],
  );
}

export async function deleteBudget(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM budgets WHERE id = ?', [id]);
}
