/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCheque, daysUntil, deleteCheque, setChequeStatus, updateCheque, type ChequeInput } from './cheques.ts';
import { createTestDb } from './testing.ts';

const U = 'u1';
const base: ChequeInput = {
  direction: 'incoming', person: ' Ahmad ', amount: '2500', currency: 'ILS', bank: ' Bank of Palestine ', number: '0012345',
  dueDate: '٢٠٢٦-١٢-٠١', note: '',
};

test('cheques: create normalizes fields, update, status changes, delete', async () => {
  const db = createTestDb();
  const id = await createCheque(db, U, base);
  const get = () => db.getOptional<Record<string, unknown>>('SELECT * FROM cheques WHERE id = ?', [id]);
  const row = (await get())!;
  assert.deepEqual(
    [row.person, row.amount_minor, row.bank, row.number, row.due_date, row.status, row.note],
    ['Ahmad', 250000, 'Bank of Palestine', '0012345', '2026-12-01', 'pending', null],
  );
  await updateCheque(db, id, { ...base, bank: '', dueDate: '2026-12-15' });
  assert.deepEqual([(await get())!.bank, (await get())!.due_date], [null, '2026-12-15']);
  await setChequeStatus(db, id, 'cleared');
  assert.equal((await get())!.status, 'cleared');
  assert.ok((await get())!.status_at);
  await setChequeStatus(db, id, 'pending');
  assert.equal((await get())!.status_at, null);
  await deleteCheque(db, id);
  assert.equal(await get(), null);
});

test('cheques: invalid amount, date and empty person are rejected', async () => {
  const db = createTestDb();
  for (const bad of [{ amount: '0' }, { amount: 'x' }, { dueDate: '2026-02-30' }, { person: ' ' }]) {
    await assert.rejects(createCheque(db, U, { ...base, ...bad }));
  }
});

test('daysUntil counts whole local days', () => {
  const now = new Date(2026, 10, 16, 23, 30);
  assert.equal(daysUntil('2026-11-16', now), 0);
  assert.equal(daysUntil('2026-11-20', now), 4);
  assert.equal(daysUntil('2026-11-10', now), -6);
});
