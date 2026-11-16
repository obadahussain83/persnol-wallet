/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { netWorth } from './net-worth.ts';

const rates = { USD: 1, ILS: 3.7, JOD: 0.709 };

test('net worth converts balances and debts into the primary currency', () => {
  const r = netWorth(
    [{ currency: 'ILS', total: 100000 }, { currency: 'USD', total: 10000 }],
    [{ direction: 'owed_to_me', currency: 'ILS', amount_minor: 5000 }, { direction: 'i_owe', currency: 'USD', amount_minor: 1000 }],
    rates, 'ILS',
  );
  assert.deepEqual(r, { balances: 137000, owedToMe: 5000, iOwe: 3700, net: 138300 });
});

test('net worth works with one currency and is null when a rate is missing', () => {
  assert.deepEqual(netWorth([{ currency: 'ILS', total: -500 }], [], {}, 'ILS'), { balances: -500, owedToMe: 0, iOwe: 0, net: -500 });
  assert.equal(netWorth([{ currency: 'EUR', total: 1 }], [], rates, 'ILS'), null);
});
