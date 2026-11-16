/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ACCOUNT_BALANCES_SQL, PERIOD_TOTALS_SQL, QUICK_ADD_SQL, type QuickAdd } from '../db/queries.ts';
import { createAccount, deleteAccount, setAccountArchived } from './accounts.ts';
import { createCategory } from './categories.ts';
import { DomainError } from './db.ts';
import { createTransaction, createTransfer, deleteTransaction } from './transactions.ts';
import { createTestDb } from './testing.ts';

const U = 'u1';
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const day = '2026-11-10T10:00:00.000Z';

async function setup() {
  const db = createTestDb();
  const acc = (name: string, currency: 'ILS' | 'USD', openingBalance = '0') =>
    createAccount(db, U, { name, type: 'cash', currency, openingBalance, description: '', color: '#0F766E', icon: 'wallet' });
  const cash = await acc('Cash', 'ILS', '100');
  const bank = await acc('Bank', 'ILS');
  const usd = await acc('USD', 'USD');
  const cat = (name: string, kind: 'expense' | 'income') => createCategory(db, U, { name, kind, parentId: null, color: '#E07A5F', icon: 'tag' });
  const food = await cat('Food', 'expense');
  const salary = await cat('Salary', 'income');
  const balances = async () =>
    Object.fromEntries((await db.getAll<{ name: string; balance_minor: number }>(ACCOUNT_BALANCES_SQL)).map((r) => [r.name, r.balance_minor]));
  return { db, cash, bank, usd, food, salary, balances };
}

test('expense and income update balances and month totals; transfers do not count as income/expense', async () => {
  const { db, cash, bank, usd, food, salary, balances } = await setup();
  await createTransaction(db, U, { type: 'expense', accountId: cash, categoryId: food, amount: '٥٠', occurredAt: day, note: ' lunch ' });
  await createTransaction(db, U, { type: 'income', accountId: bank, categoryId: salary, amount: '1000', occurredAt: day, note: '' });
  await createTransfer(db, U, { fromAccountId: bank, toAccountId: cash, amount: '200', toAmount: '', occurredAt: day, note: '' });
  await createTransfer(db, U, { fromAccountId: bank, toAccountId: usd, amount: '365', toAmount: '100', occurredAt: day, note: '' });

  assert.deepEqual(await balances(), { Cash: 10000 - 5000 + 20000, Bank: 100000 - 20000 - 36500, USD: 10000 });
  const totals = await db.getAll(PERIOD_TOTALS_SQL, ['2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z']);
  assert.deepEqual(totals.map((r) => ({ ...(r as object) })), [{ currency: 'ILS', income_minor: 100000, expense_minor: 5000 }]);
  const note = await db.getOptional<{ notes: string }>(`SELECT notes FROM transactions WHERE type = 'expense'`);
  assert.equal(note?.notes, 'lunch');
});

test('validation: category kind must match, amounts positive, accounts active and distinct', async () => {
  const { db, cash, bank, usd, food, salary } = await setup();
  const base = { type: 'expense' as const, accountId: cash, categoryId: food, amount: '10', occurredAt: day, note: '' };
  await assert.rejects(createTransaction(db, U, { ...base, categoryId: salary }), code('chooseCategory'));
  await assert.rejects(createTransaction(db, U, { ...base, amount: '0' }), code('amountPositive'));
  await assert.rejects(createTransaction(db, U, { ...base, amount: '-5' }), code('amountPositive'));
  await assert.rejects(createTransaction(db, U, { ...base, amount: '1.234' }), code('invalidAmount'));
  await assert.rejects(createTransaction(db, U, { ...base, categoryId: '' }));
  const t = { fromAccountId: cash, toAccountId: cash, amount: '1', toAmount: '', occurredAt: day, note: '' };
  await assert.rejects(createTransfer(db, U, t), code('sameAccount'));
  await assert.rejects(createTransfer(db, U, { ...t, toAccountId: usd }), code('invalidAmount')); // different currency needs toAmount
  await setAccountArchived(db, bank, true);
  await assert.rejects(createTransaction(db, U, { ...base, accountId: bank }), code('chooseAccount'));
});

test('delete is a soft delete that removes the effect on balances', async () => {
  const { db, cash, food, balances } = await setup();
  const id = await createTransaction(db, U, { type: 'expense', accountId: cash, categoryId: food, amount: '30', occurredAt: day, note: '' });
  assert.equal((await balances()).Cash, 7000);
  await deleteTransaction(db, id);
  assert.equal((await balances()).Cash, 10000);
  assert.notEqual((await db.getOptional<{ deleted_at: string }>('SELECT deleted_at FROM transactions WHERE id = ?', [id]))?.deleted_at, null);
});

test('work vs personal: totals split by scope; work profit = work income − work expenses', async () => {
  const { db, cash, bank, food, salary } = await setup();
  const { SCOPE_TOTALS_SQL } = await import('../db/queries.ts');
  const tx = (type: 'expense' | 'income', accountId: string, categoryId: string, amount: string, scope?: 'personal' | 'work') =>
    createTransaction(db, U, { type, accountId, categoryId, amount, occurredAt: day, note: '', scope });
  await tx('expense', cash, food, '40'); // personal by default
  await tx('income', bank, salary, '3000', 'work');
  await tx('expense', bank, food, '500', 'work');
  await createTransfer(db, U, { fromAccountId: bank, toAccountId: cash, amount: '100', toAmount: '', occurredAt: day, note: '' });
  const rows = (await db.getAll(SCOPE_TOTALS_SQL, ['2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'])).map((r) => ({ ...(r as object) }));
  assert.deepEqual(rows, [
    { currency: 'ILS', scope: 'personal', income_minor: 0, expense_minor: 4000 },
    { currency: 'ILS', scope: 'work', income_minor: 300000, expense_minor: 50000 },
  ]);
  await assert.rejects(tx('expense', cash, food, '1', 'other' as 'work'));
});

test('deleteAccount removes the account and its transactions, including transfers into other accounts', async () => {
  const { db, cash, bank, food, balances } = await setup();
  await createTransaction(db, U, { type: 'expense', accountId: bank, categoryId: food, amount: '10', occurredAt: day, note: '' });
  await createTransfer(db, U, { fromAccountId: bank, toAccountId: cash, amount: '20', toAmount: '', occurredAt: day, note: '' });
  await deleteAccount(db, bank);
  assert.equal(await db.getOptional('SELECT 1 AS x FROM accounts WHERE id = ?', [bank]), null);
  assert.equal((await db.getAll('SELECT 1 AS x FROM transactions WHERE deleted_at IS NULL')).length, 0);
  assert.equal((await balances()).Cash, 10000); // transfer into Cash undone
});

test('quick add suggests repeated transactions, most used first, ignoring one-offs and deleted rows', async () => {
  const { db, cash, bank, food, salary } = await setup();
  const add = (accountId: string, categoryId: string, amount: string, note = '', type: 'expense' | 'income' = 'expense') =>
    createTransaction(db, U, { type, accountId, categoryId, amount, occurredAt: day, note });
  for (let i = 0; i < 3; i++) await add(cash, food, '10', 'coffee');
  await add(cash, food, '10', 'tea'); // different note: its own group (only once)
  await add(bank, salary, '5000', '', 'income');
  const gone = await add(bank, salary, '5000', '', 'income');
  await add(bank, salary, '5000', '', 'income');
  await deleteTransaction(db, gone);
  await add(cash, food, '99'); // once only
  const rows = await db.getAll<QuickAdd>(QUICK_ADD_SQL, ['2026-01-01T00:00:00.000Z']);
  assert.deepEqual(rows.map((r) => [r.notes, r.amount_minor, r.uses]), [['coffee', 1000, 3], [null, 500000, 2]]);
});
