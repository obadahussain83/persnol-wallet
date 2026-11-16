/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ACCOUNT_BALANCES_SQL, OUTSTANDING_DEBTS_SQL, PERIOD_TOTALS_SQL } from './queries.ts';

// Plain SQLite tables shaped like the PowerSync views, so the shipped SQL is what gets tested.
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE accounts (id TEXT, name TEXT, type TEXT, currency TEXT, icon TEXT, color TEXT, opening_balance_minor INTEGER, archived_at TEXT);
    CREATE TABLE transactions (id TEXT, type TEXT, account_id TEXT, amount_minor INTEGER, currency TEXT,
      to_account_id TEXT, to_amount_minor INTEGER, occurred_at TEXT, deleted_at TEXT);
    CREATE TABLE debts (id TEXT, direction TEXT, amount_minor INTEGER, currency TEXT, settled_at TEXT);
    INSERT INTO accounts (id, name, currency, opening_balance_minor) VALUES ('cash','Cash','ILS',10000), ('bank','Bank','ILS',0), ('usd','USD','USD',0);
  `);
  const tx = db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?)');
  return { db, tx };
}

test('balances: income, expense, transfers, soft delete', () => {
  const { db, tx } = setup();
  tx.run('1', 'income', 'bank', 500000, 'ILS', null, null, '2026-11-01T00:00:00Z', null);
  tx.run('2', 'expense', 'cash', 5000, 'ILS', null, null, '2026-11-02T00:00:00Z', null);
  tx.run('3', 'transfer', 'bank', 20000, 'ILS', 'cash', 20000, '2026-11-03T00:00:00Z', null);
  tx.run('4', 'transfer', 'bank', 36500, 'ILS', 'usd', 10000, '2026-11-04T00:00:00Z', null); // 365 ILS -> 100 USD
  tx.run('5', 'expense', 'cash', 99999, 'ILS', null, null, '2026-11-05T00:00:00Z', '2026-11-06T00:00:00Z');

  const rows = db.prepare(ACCOUNT_BALANCES_SQL).all() as { id: string; balance_minor: number }[];
  const bal = Object.fromEntries(rows.map((r) => [r.id, r.balance_minor]));
  assert.deepEqual(bal, { cash: 10000 - 5000 + 20000, bank: 500000 - 20000 - 36500, usd: 10000 });
});

test('period totals exclude transfers and deleted rows', () => {
  const { db, tx } = setup();
  tx.run('1', 'income', 'bank', 500000, 'ILS', null, null, '2026-11-01T00:00:00Z', null);
  tx.run('2', 'expense', 'cash', 5000, 'ILS', null, null, '2026-11-02T00:00:00Z', null);
  tx.run('3', 'transfer', 'bank', 20000, 'ILS', 'cash', 20000, '2026-11-03T00:00:00Z', null);
  tx.run('4', 'expense', 'cash', 7000, 'ILS', null, null, '2026-10-31T23:59:59Z', null); // previous month
  tx.run('5', 'expense', 'cash', 99999, 'ILS', null, null, '2026-11-05T00:00:00Z', '2026-11-06T00:00:00Z');

  const rows = db.prepare(PERIOD_TOTALS_SQL).all('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z');
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ currency: 'ILS', income_minor: 500000, expense_minor: 5000 }]);
});

test('outstanding debts group by direction and currency, exclude settled rows, and sort deterministically', () => {
  const { db } = setup();
  const debt = db.prepare('INSERT INTO debts VALUES (?,?,?,?,?)');
  debt.run('1', 'owed_to_me', 1250, 'USD', null);
  debt.run('2', 'i_owe', 7000, 'ILS', null);
  debt.run('3', 'owed_to_me', 250, 'USD', null);
  debt.run('4', 'owed_to_me', 9000, 'ILS', '2026-11-01T00:00:00Z');
  debt.run('5', 'i_owe', 300, 'USD', null);

  const rows = db.prepare(OUTSTANDING_DEBTS_SQL).all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { direction: 'i_owe', currency: 'ILS', amount_minor: 7000 },
    { direction: 'i_owe', currency: 'USD', amount_minor: 300 },
    { direction: 'owed_to_me', currency: 'USD', amount_minor: 1500 },
  ]);
});
