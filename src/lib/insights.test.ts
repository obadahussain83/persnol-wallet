/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { monthInsights } from './insights.ts';

const food = (total: number) => ({ id: 'f', label: 'Food', total });
const fuel = (total: number) => ({ id: 'u', label: 'Fuel', total });

test('reports overall change, the biggest category jump and savings', () => {
  assert.deepEqual(
    monthInsights({ thisCats: [food(13000), fuel(5000)], lastCats: [food(10000), fuel(5000)], income: 50000, expense: 18000, overBudgets: 0 }),
    [{ key: 'spendUp', pct: 20 }, { key: 'categoryUp', label: 'Food', pct: 30 }, { key: 'saved', pct: 64 }],
  );
});

test('small changes are ignored; budgets and overspending take priority over savings; top category fills in', () => {
  assert.deepEqual(
    monthInsights({ thisCats: [food(10500), fuel(1000)], lastCats: [food(10000), fuel(1000)], income: 0, expense: 11500, overBudgets: 2 }),
    [{ key: 'overBudget', count: 2 }, { key: 'topCategory', label: 'Food', pct: 91 }],
  );
  assert.deepEqual(
    monthInsights({ thisCats: [food(6000)], lastCats: [], income: 5000, expense: 6000, overBudgets: 0 }),
    [{ key: 'overspent' }, { key: 'topCategory', label: 'Food', pct: 100 }],
  );
  assert.deepEqual(monthInsights({ thisCats: [], lastCats: [], income: 0, expense: 0, overBudgets: 0 }), []);
});
