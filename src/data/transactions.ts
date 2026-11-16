import { z } from 'zod';

import { parseAmount } from '../lib/money.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

// Messages are i18n keys under `errors.`.
const note = z.string().trim().max(500, 'tooLong');

export const transactionInputSchema = z.object({
  type: z.enum(['expense', 'income']),
  accountId: z.string().min(1, 'chooseAccount'),
  categoryId: z.string().min(1, 'chooseCategory'),
  amount: z.string().trim().min(1, 'required'),
  occurredAt: z.string().min(1),
  note,
  scope: z.enum(['personal', 'work']).default('personal'),
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

export const transferInputSchema = z.object({
  fromAccountId: z.string().min(1, 'chooseAccount'),
  toAccountId: z.string().min(1, 'chooseAccount'),
  amount: z.string().trim().min(1, 'required'),
  /** Received amount; only needed when the two accounts use different currencies. */
  toAmount: z.string().trim(),
  occurredAt: z.string().min(1),
  note,
});
export type TransferInput = z.input<typeof transferInputSchema>;

type Account = { id: string; currency: string; archived_at: string | null };

async function activeAccount(db: Db, id: string): Promise<Account> {
  const a = await db.getOptional<Account>('SELECT id, currency, archived_at FROM accounts WHERE id = ?', [id]);
  if (!a || a.archived_at) throw new DomainError('chooseAccount');
  return a;
}

function positiveMinor(amount: string, currency: string): number {
  let minor: number;
  try {
    minor = parseAmount(amount, currency);
  } catch {
    throw new DomainError('invalidAmount');
  }
  if (minor <= 0) throw new DomainError('amountPositive');
  return minor;
}

/** Validates an income/expense against its account and category; returns the account and the amount in minor units. */
export async function resolveTransaction(db: Db, v: z.output<typeof transactionInputSchema>) {
  const account = await activeAccount(db, v.accountId);
  const category = await db.getOptional<{ kind: string; archived_at: string | null }>(
    'SELECT kind, archived_at FROM categories WHERE id = ?', [v.categoryId]);
  // An expense must use an expense category (and vice versa), or reports would misclassify it.
  if (!category || category.archived_at || category.kind !== v.type) throw new DomainError('chooseCategory');
  return { account, amount: positiveMinor(v.amount, account.currency) };
}

/** `fixedId` makes the insert idempotent: if that row already exists (even soft-deleted), nothing is written. */
export async function createTransaction(db: Db, userId: string, input: TransactionInput, fixedId?: string): Promise<string> {
  const v = transactionInputSchema.parse(input);
  if (fixedId && (await db.getOptional('SELECT 1 AS x FROM transactions WHERE id = ?', [fixedId]))) return fixedId;
  const { account, amount } = await resolveTransaction(db, v);
  const id = fixedId ?? (await newId(db));
  const now = nowIso();
  await db.execute(
    `INSERT INTO transactions (id, user_id, type, account_id, amount_minor, currency, category_id, occurred_at, notes, scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.type, account.id, amount, account.currency, v.categoryId, v.occurredAt, v.note || null, v.scope, now, now],
  );
  return id;
}

/** One row moves money between two own accounts; it never counts as income or expense. */
export async function createTransfer(db: Db, userId: string, input: TransferInput): Promise<string> {
  const v = transferInputSchema.parse(input);
  if (v.fromAccountId === v.toAccountId) throw new DomainError('sameAccount');
  const from = await activeAccount(db, v.fromAccountId);
  const to = await activeAccount(db, v.toAccountId);
  const amount = positiveMinor(v.amount, from.currency);
  const toAmount = from.currency === to.currency ? amount : positiveMinor(v.toAmount, to.currency);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO transactions (id, user_id, type, account_id, amount_minor, currency, to_account_id, to_amount_minor, occurred_at, notes, scope, created_at, updated_at)
     VALUES (?, ?, 'transfer', ?, ?, ?, ?, ?, ?, ?, 'personal', ?, ?)`,
    [id, userId, from.id, amount, from.currency, to.id, toAmount, v.occurredAt, v.note || null, now, now],
  );
  return id;
}

/** Soft delete: the row stays (and syncs) as a tombstone, so other devices remove it too. */
export async function deleteTransaction(db: Db, id: string): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, id]);
}
