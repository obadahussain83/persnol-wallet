/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAccount, setAccountArchived } from './accounts.ts';
import { createCategory } from './categories.ts';
import { DomainError } from './db.ts';
import { createRecurring, deleteRecurring, generateDue, nextOccurrence, occurrenceId, occurrences, setRecurringPaused } from './recurring.ts';
import { createTestDb } from './testing.ts';
import { deleteTransaction } from './transactions.ts';

const U = 'u1';
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const days = (ds: Date[]) => ds.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);

test('occurrences: monthly clamps to short months, weekly and yearly step correctly', () => {
  assert.deepEqual(days(occurrences(new Date(2026, 0, 31), 'monthly', new Date(2026, 3, 30))), ['2026-1-31', '2026-2-28', '2026-3-31', '2026-4-30']);
  assert.deepEqual(days(occurrences(new Date(2026, 10, 1), 'weekly', new Date(2026, 10, 16))), ['2026-11-1', '2026-11-8', '2026-11-15']);
  assert.deepEqual(days(occurrences(new Date(2024, 1, 29), 'yearly', new Date(2026, 5, 1))), ['2024-2-29', '2025-2-28', '2026-2-28']);
  assert.deepEqual(occurrences(new Date(2026, 11, 1), 'monthly', new Date(2026, 10, 16)), []); // starts in the future
});

test('occurrenceId is a valid, deterministic uuid per rule and day', () => {
  const rule = '123e4567-e89b-42d3-a456-426614174000';
  const id = occurrenceId(rule, new Date(2026, 10, 5));
  assert.equal(id, '123e4567-e89b-42d3-a456-202611050000');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

async function setup() {
  const db = createTestDb();
  const cash = await createAccount(db, U, { name: 'Cash', type: 'cash', currency: 'ILS', openingBalance: '0', description: '', color: '#0F766E', icon: 'wallet' });
  const rent = await createCategory(db, U, { name: 'Rent', kind: 'expense', parentId: null, color: '#E07A5F', icon: 'house' });
  const salary = await createCategory(db, U, { name: 'Salary', kind: 'income', parentId: null, color: '#E07A5F', icon: 'briefcase' });
  const live = () => db.getAll<{ amount_minor: number; occurred_at: string; type: string }>(
    'SELECT amount_minor, occurred_at, type FROM transactions WHERE deleted_at IS NULL ORDER BY occurred_at');
  return { db, cash, rent, salary, live };
}

test('generateDue creates each due occurrence once, skips deleted ones, honors pause and delete', async () => {
  const { db, cash, rent, live } = await setup();
  const rule = await createRecurring(db, U, {
    type: 'expense', accountId: cash, categoryId: rent, amount: '1500', note: 'rent', scope: 'personal', frequency: 'monthly', startDate: '2026-09-01',
  });
  const now = new Date(2026, 10, 16);
  assert.equal(await generateDue(db, U, now), 3); // Sep, Oct, Nov
  assert.equal(await generateDue(db, U, now), 0); // idempotent
  assert.deepEqual((await live()).map((t) => t.amount_minor), [150000, 150000, 150000]);

  await deleteTransaction(db, occurrenceId(rule, new Date(2026, 9, 1)));
  assert.equal(await generateDue(db, U, now), 0); // a deleted occurrence is not recreated
  assert.equal((await live()).length, 2);

  await setRecurringPaused(db, rule, true);
  assert.equal(await generateDue(db, U, new Date(2026, 11, 2)), 0);
  await setRecurringPaused(db, rule, false);
  assert.equal(await generateDue(db, U, new Date(2026, 11, 2)), 1); // December catches up on resume
  await deleteRecurring(db, rule);
  assert.equal(await generateDue(db, U, new Date(2027, 2, 2)), 0);
});

test('createRecurring validates like a transaction; an archived account pauses generation', async () => {
  const { db, cash, rent, salary } = await setup();
  const base = { type: 'expense' as const, accountId: cash, categoryId: rent, amount: '10', note: '', scope: 'personal' as const, frequency: 'weekly' as const, startDate: '2026-11-01' };
  await assert.rejects(createRecurring(db, U, { ...base, categoryId: salary }), code('chooseCategory'));
  await assert.rejects(createRecurring(db, U, { ...base, amount: '0' }), code('amountPositive'));
  await assert.rejects(createRecurring(db, U, { ...base, startDate: '2026-02-30' }));
  await createRecurring(db, U, base);
  await setAccountArchived(db, cash, true);
  assert.equal(await generateDue(db, U, new Date(2026, 10, 16)), 0);
});

test('nextOccurrence is the first one after today', () => {
  const now = new Date(2026, 10, 16, 9);
  assert.deepEqual(days([nextOccurrence(new Date(2026, 0, 31), 'monthly', now)]), ['2026-11-30']);
  assert.deepEqual(days([nextOccurrence(new Date(2026, 10, 16), 'weekly', now)]), ['2026-11-23']); // today already happened
  assert.deepEqual(days([nextOccurrence(new Date(2027, 0, 5), 'yearly', now)]), ['2027-1-5']); // future start
});
