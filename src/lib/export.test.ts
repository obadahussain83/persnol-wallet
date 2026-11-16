/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import type { TransactionListRow } from '../db/queries.ts';
import { buildSheets, type ExportData } from './export.ts';

const t = (key: string) => key; // headers and labels come back as their keys
const labelOf = (c: { key: string | null; name: string | null }) => c.name ?? c.key ?? '';

const tx = (over: Partial<TransactionListRow>): TransactionListRow => ({
  id: 'x', type: 'expense', scope: 'personal', amount_minor: 0, currency: 'ILS', to_amount_minor: null, to_currency: null,
  occurred_at: '2026-11-10T12:00:00Z', notes: null, account_id: 'a1', to_account_id: null, category_id: null, account_name: 'Cash', to_account_name: null,
  category_key: null, category_name: null, category_icon: null, category_color: null, ...over,
});

const data: ExportData = {
  transactions: [
    tx({ type: 'income', amount_minor: 10000, category_name: 'Salary', notes: 'Nov' }),
    tx({ type: 'expense', scope: 'work', amount_minor: 2550, category_name: 'Fuel' }),
    tx({ type: 'transfer', amount_minor: 5000, currency: 'USD', to_amount_minor: 18250, to_currency: 'ILS', to_account_name: 'Bank' }),
  ],
  accounts: [
    { id: 'a', name: 'Cash', type: 'cash', currency: 'JOD', icon: null, color: null, archived_at: null, balance_minor: 12345 },
    { id: 'b', name: 'Old', type: 'bank', currency: 'ILS', icon: null, color: null, archived_at: '2026-01-01T00:00:00Z', balance_minor: -500 },
  ],
  debts: [
    { direction: 'owed_to_me', person: 'Ali', amount_minor: 3000, currency: 'ILS', note: null, settled_at: null, created_at: '2026-11-01T12:00:00Z' },
    { direction: 'i_owe', person: 'Sara', amount_minor: 700, currency: 'USD', note: 'lunch', settled_at: '2026-11-05T12:00:00Z', created_at: '2026-11-02T12:00:00Z' },
  ],
};

test('builds one sheet per record kind with exact, signed amounts', () => {
  const [txs, accounts, debts] = buildSheets(data, t, labelOf);
  assert.deepEqual([txs.name, accounts.name, debts.name], ['tx.title', 'accounts.title', 'debts.title']);
  assert.equal(txs.rows.length, 4); // header + 3

  assert.deepEqual(txs.rows[1], ['2026-11-10', 'tx.income', 'tx.personal', 'Salary', 'Cash', '', 100, 'ILS', '', '', 'Nov']);
  assert.deepEqual(txs.rows[2].slice(1, 8), ['tx.expense', 'tx.work', 'Fuel', 'Cash', '', -25.5, 'ILS']);
  // Transfers carry both sides and no scope or category.
  assert.deepEqual(txs.rows[3].slice(1, 10), ['tx.transfer', '', '', 'Cash', 'Bank', 50, 'USD', 182.5, 'ILS']);

  assert.deepEqual(accounts.rows[1], ['Cash', 'accountTypes.cash', 'JOD', 12.345, '']); // JOD keeps 3 decimals
  assert.deepEqual(accounts.rows[2].slice(3), [-5, 'common.archived']);

  assert.deepEqual(debts.rows[1], ['2026-11-01', 'debts.owedToMe', 'Ali', 30, 'ILS', 'debts.outstanding', '']);
  assert.deepEqual(debts.rows[2].slice(1, 7), ['debts.iOwe', 'Sara', 7, 'USD', 'debts.settled', 'lunch']);
});

test('the rows survive a round trip through a real .xlsx file', () => {
  const book = XLSX.utils.book_new();
  for (const s of buildSheets(data, t, labelOf)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  const back = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  assert.deepEqual(back.SheetNames, ['tx.title', 'accounts.title', 'debts.title']);
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(back.Sheets['tx.title'], { header: 1 });
  assert.equal(rows[2][6], -25.5); // stored as a number, so Excel can sum it
});
