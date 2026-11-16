/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { monthlyFlow } from './reports.ts';

test('monthlyFlow buckets by local month, one currency, drops rows outside the window', () => {
  const now = new Date(2026, 10, 16);
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).toISOString();
  const rows = [
    { type: 'income', currency: 'ILS', amount_minor: 1000, occurred_at: at(2026, 10, 1) },
    { type: 'expense', currency: 'ILS', amount_minor: 300, occurred_at: at(2026, 10, 15) },
    { type: 'expense', currency: 'ILS', amount_minor: 200, occurred_at: at(2026, 9, 31) },
    { type: 'expense', currency: 'USD', amount_minor: 999, occurred_at: at(2026, 10, 2) },
    { type: 'expense', currency: 'ILS', amount_minor: 5, occurred_at: at(2026, 7, 1) }, // before the 3-month window
  ];
  const flow = monthlyFlow(rows, 'ILS', 3, now);
  assert.deepEqual(flow.map((m) => [m.start.getMonth(), m.income, m.expense]), [[8, 0, 0], [9, 0, 200], [10, 1000, 300]]);
});
