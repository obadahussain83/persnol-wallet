/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ACCOUNT_BALANCES_SQL } from '../db/queries.ts';
import { createAccount, setAccountArchived, updateAccount, type AccountInput } from './accounts.ts';
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from './categories.ts';
import { DomainError } from './db.ts';
import { createDebt, deleteDebt, setDebtSettled, updateDebt, type DebtInput } from './debts.ts';
import { DEFAULT_CATEGORIES } from './default-categories.ts';
import { seedLocalOnlyUser, updateProfile } from './profile.ts';
import { createTestDb } from './testing.ts';

const U = 'user-1';
const cash: AccountInput = {
  name: ' Wallet ', type: 'cash', currency: 'JOD', openingBalance: '12.345', description: '', color: '#0F766E', icon: 'wallet',
};
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;

test('createAccount stores trimmed fields and exact opening balance in minor units', async () => {
  const db = createTestDb();
  const id = await createAccount(db, U, cash);
  const row = await db.getOptional<Record<string, unknown>>('SELECT * FROM accounts WHERE id = ?', [id]);
  assert.equal(row?.name, 'Wallet');
  assert.equal(row?.opening_balance_minor, 12345);
  assert.equal(row?.user_id, U);
  assert.equal(row?.description, null);
});

test('debts: both directions, positive exact amounts, settle/reopen, delete', async () => {
  const db = createTestDb();
  const debt: DebtInput = { direction: 'owed_to_me', person: ' Ahmad ', amount: '12.345', currency: 'JOD', note: '' };
  const id = await createDebt(db, U, debt);
  const get = () => db.getOptional<Record<string, unknown>>('SELECT * FROM debts WHERE id = ?', [id]);
  assert.deepEqual(
    (({ direction, person, amount_minor, note, settled_at }) => ({ direction, person, amount_minor, note, settled_at }))((await get())!),
    { direction: 'owed_to_me', person: 'Ahmad', amount_minor: 12345, note: null, settled_at: null },
  );
  for (const amount of ['0', '-5', '', '1.2345']) await assert.rejects(createDebt(db, U, { ...debt, amount }));
  await assert.rejects(createDebt(db, U, { ...debt, direction: 'x' as 'i_owe' }));
  await assert.rejects(updateDebt(db, 'missing', debt), code('notFound'));

  await updateDebt(db, id, { ...debt, direction: 'i_owe', amount: '5' });
  assert.equal((await get())?.direction, 'i_owe');
  assert.equal((await get())?.amount_minor, 5000);
  await setDebtSettled(db, id, true);
  assert.ok((await get())?.settled_at);
  await setDebtSettled(db, id, false);
  assert.equal((await get())?.settled_at, null);
  await deleteDebt(db, id);
  assert.equal(await get(), null);
});

test('account validation rejects bad input', async () => {
  const db = createTestDb();
  await assert.rejects(createAccount(db, U, { ...cash, name: '  ' }));
  await assert.rejects(createAccount(db, U, { ...cash, openingBalance: '1.2345' })); // JOD has 3dp
  await assert.rejects(createAccount(db, U, { ...cash, currency: 'XXX' as 'USD' }));
  await assert.rejects(createAccount(db, U, { ...cash, color: 'red' }));
});

test('account currency is locked once it has transactions; archiving hides it from balances', async () => {
  const db = createTestDb();
  const id = await createAccount(db, U, cash);
  await updateAccount(db, id, { ...cash, currency: 'USD', openingBalance: '1.00' }); // no history yet: allowed
  await db.execute(`INSERT INTO transactions (id, type, account_id, amount_minor, currency) VALUES ('t1','expense',?,100,'USD')`, [id]);
  await assert.rejects(updateAccount(db, id, { ...cash, currency: 'ILS', openingBalance: '1' }), code('currencyLocked'));
  await updateAccount(db, id, { ...cash, currency: 'USD', openingBalance: '2', name: 'Renamed' }); // same currency: fine

  assert.equal((await db.getAll(ACCOUNT_BALANCES_SQL)).length, 1);
  await setAccountArchived(db, id, true);
  assert.equal((await db.getAll(ACCOUNT_BALANCES_SQL)).length, 0);
});

test('categories: one nesting level, same kind, kind fixed', async () => {
  const db = createTestDb();
  const base = { color: '#E07A5F', icon: 'utensils', parentId: null };
  const food = await createCategory(db, U, { ...base, name: 'Food', kind: 'expense' });
  const salary = await createCategory(db, U, { ...base, name: 'Salary', kind: 'income' });
  const groceries = await createCategory(db, U, { ...base, name: 'Groceries', kind: 'expense', parentId: food });

  await assert.rejects(createCategory(db, U, { ...base, name: 'x', kind: 'income', parentId: food }), code('invalidParent'));
  await assert.rejects(createCategory(db, U, { ...base, name: 'x', kind: 'expense', parentId: groceries }), code('invalidParent'));
  await assert.rejects(updateCategory(db, food, { ...base, name: 'Food', parentId: food }), code('invalidParent'));
  await assert.rejects(updateCategory(db, food, { ...base, name: 'Food', parentId: salary }), code('invalidParent'));
  const other = await createCategory(db, U, { ...base, name: 'Other', kind: 'expense' });
  await assert.rejects(updateCategory(db, food, { ...base, name: 'Food', parentId: other }), code('hasSubcategories'));
});

test('categories: archive cascades to children; restore brings back parent; delete only when unused', async () => {
  const db = createTestDb();
  const base = { color: '#E07A5F', icon: 'utensils', kind: 'expense' as const };
  const food = await createCategory(db, U, { ...base, name: 'Food', parentId: null });
  const groceries = await createCategory(db, U, { ...base, name: 'Groceries', parentId: food });
  const archived = async () =>
    (await db.getAll<{ name: string }>('SELECT name FROM categories WHERE archived_at IS NOT NULL ORDER BY name')).map((r) => r.name);

  await setCategoryArchived(db, food, true);
  assert.deepEqual(await archived(), ['Food', 'Groceries']);
  await setCategoryArchived(db, groceries, false);
  assert.deepEqual(await archived(), []);

  await assert.rejects(deleteCategory(db, food), code('categoryInUse')); // has a subcategory
  await db.execute(`INSERT INTO transactions (id, type, category_id) VALUES ('t1','expense',?)`, [groceries]);
  await assert.rejects(deleteCategory(db, groceries), code('categoryInUse'));
  const unused = await createCategory(db, U, { ...base, name: 'Unused', parentId: null });
  await deleteCategory(db, unused);
  assert.equal(await db.getOptional('SELECT 1 AS x FROM categories WHERE id = ?', [unused]), null);
});

test('local-only seeding is idempotent; profile update validates currency', async () => {
  const db = createTestDb();
  await seedLocalOnlyUser(db, U);
  await seedLocalOnlyUser(db, U);
  const n = await db.getOptional<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  assert.equal(n?.n, DEFAULT_CATEGORIES.length);
  await updateProfile(db, U, { displayName: ' Sam ', primaryCurrency: 'USD' });
  assert.deepEqual({ ...(await db.getOptional<object>('SELECT display_name, primary_currency FROM profiles WHERE id = ?', [U])) }, {
    display_name: 'Sam',
    primary_currency: 'USD',
  });
  await assert.rejects(updateProfile(db, U, { displayName: '', primaryCurrency: 'XXX' as 'USD' }));
});

test('default category list matches the signup trigger in the migration', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261110000000_phase1_profiles.sql', import.meta.url), 'utf8');
  const fromSql = [...sql.matchAll(/\('(\w+)', '([^']+)', '(expense|income)', '(#[0-9A-F]{6})', '([\w-]+)'\)/g)].map(
    ([, key, name, kind, color, icon]) => ({ key, name, kind, color, icon }),
  );
  assert.deepEqual(fromSql, DEFAULT_CATEGORIES.map((c) => ({ ...c })));
});

test('renaming a built-in category clears its translation key; other edits keep it', async () => {
  const db = createTestDb();
  await seedLocalOnlyUser(db, U);
  const food = await db.getOptional<{ id: string }>(`SELECT id FROM categories WHERE key = 'food'`);
  const keep = { name: 'Food', parentId: null, color: '#000000', icon: 'utensils' };
  await updateCategory(db, food!.id, keep);
  assert.equal((await db.getOptional<{ key: string }>('SELECT key FROM categories WHERE id = ?', [food!.id]))?.key, 'food');
  await updateCategory(db, food!.id, { ...keep, name: 'Groceries' });
  assert.equal((await db.getOptional<{ key: string | null }>('SELECT key FROM categories WHERE id = ?', [food!.id]))?.key, null);
});

test('orderCategoryTree groups children under sorted parents', async () => {
  const { orderCategoryTree } = await import('./categories.ts');
  const rows = [
    { id: 'b', parent_id: null, n: 'Bills' }, { id: 'a2', parent_id: 'a', n: 'Zoo' }, { id: 'a', parent_id: null, n: 'Animals' },
    { id: 'a1', parent_id: 'a', n: 'Cats' }, { id: 'o', parent_id: 'gone', n: 'Orphan' },
  ];
  assert.deepEqual(orderCategoryTree(rows, (r) => r.n).map((x) => `${x.depth}:${x.row.n}`), ['0:Animals', '1:Cats', '1:Zoo', '0:Bills', '0:Orphan']);
});
