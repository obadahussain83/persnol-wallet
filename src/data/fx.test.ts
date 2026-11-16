/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { convert } from '../lib/money.ts';
import { clearManualRate, crossRate, loadRates, ratesOf, refreshRates, setManualRate } from './fx.ts';
import { createTestDb } from './testing.ts';

const api = (rates: Record<string, number>) => {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => ({ result: 'success', rates }) };
  }) as unknown as typeof fetch;
  return { fn, calls };
};

test('refreshRates fetches when missing or stale, keeps manual rates, and converts across currencies', async () => {
  const db = createTestDb();
  const { fn, calls } = api({ USD: 1, ILS: 3.7, EUR: 0.92, JOD: 0.709, GBP: 0.8 });
  const t0 = new Date('2026-11-16T08:00:00Z');
  assert.equal(await refreshRates(db, fn, t0), true);
  assert.equal(await refreshRates(db, fn, new Date('2026-11-16T12:00:00Z')), false); // fresh
  assert.equal(calls.length, 1);
  const rates = ratesOf(await loadRates(db));
  assert.deepEqual(Object.keys(rates).sort(), ['EUR', 'ILS', 'JOD', 'USD']); // only supported currencies

  // 100 USD → ILS; 10 JOD (3 decimals) → ILS
  assert.equal(convert(10000, 'USD', 'ILS', crossRate(rates, 'USD', 'ILS')!), 37000);
  assert.equal(convert(10000, 'JOD', 'ILS', crossRate(rates, 'JOD', 'ILS')!), 5219);
  assert.equal(crossRate(rates, 'ILS', 'ILS'), '1');
  assert.equal(crossRate(rates, 'ILS', 'XXX'), null);

  await setManualRate(db, 'USD', 'ILS', 3.5); // "1 USD = 3.5 ILS"
  const { fn: fn2 } = api({ USD: 1, ILS: 3.9, EUR: 0.9, JOD: 0.709 });
  assert.equal(await refreshRates(db, fn2, new Date('2026-11-17T09:00:00Z')), true); // stale → refetch
  const after = ratesOf(await loadRates(db));
  assert.equal(after.ILS, 3.9);
  assert.equal(convert(10000, 'USD', 'ILS', crossRate(after, 'USD', 'ILS')!), 35000); // manual stays 1 USD = 3.5 ILS
  assert.equal(convert(10000, 'EUR', 'ILS', crossRate(after, 'EUR', 'ILS')!), 43333); // others follow the fresh rates

  await clearManualRate(db, 'USD');
  assert.equal(ratesOf(await loadRates(db)).USD, undefined);
});

test('refreshRates surfaces bad responses', async () => {
  const db = createTestDb();
  const bad = (async () => ({ ok: true, status: 200, json: async () => ({ result: 'error' }) })) as unknown as typeof fetch;
  await assert.rejects(refreshRates(db, bad));
  const down = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
  await assert.rejects(refreshRates(db, down));
});
