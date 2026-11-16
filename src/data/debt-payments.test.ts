/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OUTSTANDING_DEBTS_SQL } from '../db/queries.ts';
import { DomainError } from './db.ts';
import { addDebtPayment, createDebt, debtPaid, deleteDebt, deleteDebtPayment, updateDebt, whatsappUrl, type DebtInput } from './debts.ts';
import { createTestDb } from './testing.ts';

const U = 'u1';
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const at = '2026-11-16T10:00:00.000Z';
const debt: DebtInput = { direction: 'owed_to_me', person: 'Ahmad', amount: '100', currency: 'ILS', note: '', dueDate: '', phone: '' };

test('partial payments reduce what is outstanding, settle at zero, and reopen when removed', async () => {
  const db = createTestDb();
  const id = await createDebt(db, U, debt);
  const settled = async () => (await db.getOptional<{ settled_at: string | null }>('SELECT settled_at FROM debts WHERE id = ?', [id]))!.settled_at;

  await addDebtPayment(db, U, id, '30', at);
  await addDebtPayment(db, U, id, '20.5', at);
  assert.equal(await debtPaid(db, id), 5050);
  assert.deepEqual((await db.getAll(OUTSTANDING_DEBTS_SQL)).map((r) => ({ ...(r as object) })),
    [{ direction: 'owed_to_me', currency: 'ILS', amount_minor: 4950 }]);

  await assert.rejects(addDebtPayment(db, U, id, '49.51', at), code('paymentTooLarge'));
  await assert.rejects(addDebtPayment(db, U, id, '0', at), code('amountPositive'));
  await assert.rejects(addDebtPayment(db, U, id, 'abc', at), code('invalidAmount'));
  assert.equal(await settled(), null);

  const last = await addDebtPayment(db, U, id, '49.50', at);
  assert.ok(await settled());
  assert.deepEqual(await db.getAll(OUTSTANDING_DEBTS_SQL), []);

  await deleteDebtPayment(db, last);
  assert.equal(await settled(), null);
  await deleteDebt(db, id);
  assert.equal((await db.getAll('SELECT 1 AS x FROM debt_payments')).length, 0);
});

test('debt edits keep payments consistent; due date and phone are validated and stored', async () => {
  const db = createTestDb();
  const id = await createDebt(db, U, { ...debt, dueDate: '٢٠٢٦-١٢-٠١', phone: '+970 599-123456' });
  const row = (await db.getOptional<{ due_date: string; phone: string }>('SELECT due_date, phone FROM debts WHERE id = ?', [id]))!;
  assert.deepEqual([row.due_date, row.phone], ['2026-12-01', '+970 599-123456']);
  await assert.rejects(createDebt(db, U, { ...debt, dueDate: '2026-02-30' }));
  await assert.rejects(createDebt(db, U, { ...debt, phone: 'call me' }));

  await addDebtPayment(db, U, id, '40', at);
  await assert.rejects(updateDebt(db, id, { ...debt, amount: '39' }), code('amountBelowPaid'));
  await assert.rejects(updateDebt(db, id, { ...debt, currency: 'USD' }), code('currencyLocked'));
  await updateDebt(db, id, { ...debt, amount: '150', dueDate: '' });
  assert.equal((await db.getOptional<{ due_date: string | null }>('SELECT due_date FROM debts WHERE id = ?', [id]))!.due_date, null);
});

test('whatsappUrl uses international numbers only and encodes the message', () => {
  assert.equal(whatsappUrl('+970 599-123456', 'hi there'), 'https://wa.me/970599123456?text=hi%20there');
  assert.equal(whatsappUrl('00972501234567', 'x'), 'https://wa.me/972501234567?text=x');
  assert.equal(whatsappUrl('0599123456', 'x'), 'https://wa.me/?text=x'); // local number: let the user pick the contact
  assert.equal(whatsappUrl(null, 'x'), 'https://wa.me/?text=x');
});
