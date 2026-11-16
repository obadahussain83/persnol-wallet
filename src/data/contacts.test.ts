/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCheque, setChequeStatus } from './cheques.ts';
import { CONTACT_BALANCE_SQL, type ContactBalance, createContact, deleteContact, updateContact } from './contacts.ts';
import { addDebtPayment, createDebt } from './debts.ts';
import { createTestDb } from './testing.ts';

const U = 'u1';

test('contact statement sums open debts (after payments) and pending cheques per currency', async () => {
  const db = createTestDb();
  const c = await createContact(db, U, { name: ' Abu Ali Store ', kind: 'supplier', phone: '', note: '' });
  const other = await createContact(db, U, { name: 'Someone', kind: 'client', phone: '', note: '' });
  const debt = (direction: 'owed_to_me' | 'i_owe', amount: string, contactId = c, currency: 'ILS' | 'USD' = 'ILS') =>
    createDebt(db, U, { direction, person: 'x', amount, currency, note: '', dueDate: '', phone: '', contactId });
  const cheque = (direction: 'incoming' | 'outgoing', amount: string) =>
    createCheque(db, U, { direction, person: 'x', amount, currency: 'ILS', bank: '', number: '', dueDate: '2026-12-01', note: '', contactId: c });

  const d1 = await debt('owed_to_me', '100');
  await addDebtPayment(db, U, d1, '40', '2026-11-16T10:00:00.000Z');
  await debt('i_owe', '30');
  await debt('owed_to_me', '5', c, 'USD');
  await debt('owed_to_me', '999', other); // another contact
  await cheque('outgoing', '200');
  const cleared = await cheque('incoming', '50');
  await setChequeStatus(db, cleared, 'cleared'); // no longer open

  const rows = await db.getAll<ContactBalance>(CONTACT_BALANCE_SQL, [c, c]);
  assert.deepEqual(rows.map((r) => ({ ...r })), [
    { currency: 'ILS', owed_to_me_minor: 6000, i_owe_minor: 23000 },
    { currency: 'USD', owed_to_me_minor: 500, i_owe_minor: 0 },
  ]);
});

test('renaming a contact renames linked records; deleting unlinks them', async () => {
  const db = createTestDb();
  const c = await createContact(db, U, { name: 'Old', kind: 'client', phone: '+970 599', note: '' });
  const d = await createDebt(db, U, { direction: 'owed_to_me', person: 'Old', amount: '1', currency: 'ILS', note: '', dueDate: '', phone: '', contactId: c });
  await updateContact(db, c, { name: 'New', kind: 'client', phone: '', note: '' });
  const get = () => db.getOptional<{ person: string; contact_id: string | null }>('SELECT person, contact_id FROM debts WHERE id = ?', [d]);
  assert.equal((await get())!.person, 'New');
  await deleteContact(db, c);
  assert.deepEqual({ ...(await get()) }, { person: 'New', contact_id: null });
  await assert.rejects(createContact(db, U, { name: ' ', kind: 'client', phone: '', note: '' }));
  await assert.rejects(createContact(db, U, { name: 'x', kind: 'client', phone: 'abc', note: '' }));
});
