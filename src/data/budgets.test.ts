/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BUDGET_PROGRESS_SQL, type BudgetProgress, EXPENSE_BY_CATEGORY_SQL, type CategorySpend } from '../db/queries.ts';
import { createAccount } from './accounts.ts';
import { createBudget, deleteBudget, updateBudget } from './budgets.ts';
import { createCategory, deleteCategory } from './categories.ts';
import { DomainError } from './db.ts';
import { createTestDb } from './testing.ts';
import { createTransaction, deleteTransaction } from './transactions.ts';

const U = 'u1';
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const day = '2026-11-10T10:00:00.000Z';
const range = ['2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'];

async function setup() {
  const db = createTestDb();
  const acc = (name: string, currency: 'ILS' | 'USD') =>
    createAccount(db, U, { name, type: 'cash', currency, openingBalance: '0', description: '', color: '#0F766E', icon: 'wallet' });
  const ils = await acc('Cash', 'ILS');
  const usd = await acc('USD', 'USD');
  const cat = (name: string, parentId: string | null = null) =>
    createCategory(db, U, { name, kind: 'expense', parentId, color: '#E07A5F', icon: 'tag' });
  const food = await cat('Food');
  const groceries = await cat('Groceries', food);
  const fun = await cat('Fun');
  const spend = (accountId: string, categoryId: string, amount: string, occurredAt = day) =>
    createTransaction(db, U, { type: 'expense', accountId, categoryId, amount, occurredAt, note: '' });
  return { db, ils, usd, food, groceries, fun, spend };
}

test('budget progress counts subcategories, its own currency, this period, and skips deleted rows', async () => {
  const { db, ils, usd, food, groceries, fun, spend } = await setup();
  await createBudget(db, U, { categoryId: food, amount: '500', currency: 'ILS' });
  await spend(ils, food, '100');
  await spend(ils, groceries, '50');
  await spend(ils, fun, '70'); // other category
  await spend(usd, food, '9'); // other currency
  await spend(ils, food, '40', '2026-10-31T10:00:00.000Z'); // previous month
  const gone = await spend(ils, food, '1000');
  await deleteTransaction(db, gone);
  const [b] = await db.getAll<BudgetProgress>(BUDGET_PROGRESS_SQL, range);
  assert.equal(b.amount_minor, 50000);
  assert.equal(b.spent_minor, 15000);
});

test('budgets: validation, one per category+currency, update, delete, removed with their category', async () => {
  const { db, food, fun } = await setup();
  for (const amount of ['0', '-1', 'abc']) await assert.rejects(createBudget(db, U, { categoryId: food, amount, currency: 'ILS' }));
  const id = await createBudget(db, U, { categoryId: food, amount: '500', currency: 'ILS' });
  await createBudget(db, U, { categoryId: food, amount: '100', currency: 'USD' }); // same category, other currency is fine
  await assert.rejects(createBudget(db, U, { categoryId: food, amount: '1', currency: 'ILS' }), code('budgetExists'));
  await updateBudget(db, id, { categoryId: food, amount: '600', currency: 'ILS' }); // editing itself is not a duplicate
  assert.equal((await db.getOptional<{ amount_minor: number }>('SELECT amount_minor FROM budgets WHERE id = ?', [id]))?.amount_minor, 60000);
  const funBudget = await createBudget(db, U, { categoryId: fun, amount: '50', currency: 'ILS' });
  await deleteCategory(db, fun); // an unused category takes its budget with it
  assert.equal(await db.getOptional('SELECT 1 AS x FROM budgets WHERE id = ?', [funBudget]), null);
  await deleteBudget(db, id);
  assert.equal(await db.getOptional('SELECT 1 AS x FROM budgets WHERE id = ?', [id]), null);
});

test('expense by category rolls subcategories into their parent', async () => {
  const { db, ils, food, groceries, fun, spend } = await setup();
  await spend(ils, food, '100');
  await spend(ils, groceries, '50');
  await spend(ils, fun, '20');
  const rows = await db.getAll<CategorySpend>(EXPENSE_BY_CATEGORY_SQL, range);
  assert.deepEqual(rows.map((r) => [r.category_id, r.total_minor]), [[food, 15000], [fun, 2000]]);
});
