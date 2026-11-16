/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DomainError } from './db.ts';
import {
  createInvoice, deleteInvoice, invoiceTotal, lineTotal, nextInvoiceNumber, parseItems, quoteToInvoice, setInvoiceStatus, updateInvoice,
  type InvoiceInput,
} from './invoices.ts';
import { createTestDb } from './testing.ts';

const U = 'u1';
const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const base: InvoiceInput = {
  kind: 'invoice', clientName: ' Abu Ali ', currency: 'ILS', issueDate: '2026-11-16', dueDate: '',
  items: [{ description: 'Design', quantity: '1.5', unitPrice: '200' }, { description: 'Hosting', quantity: '٢', unitPrice: '35.50' }],
  note: '',
};

test('line totals use exact decimal math with half-up rounding', () => {
  assert.equal(lineTotal(20000, '1.5'), 30000);
  assert.equal(lineTotal(333, '0.5'), 167); // 166.5 → 167
  assert.equal(lineTotal(1, '0.001'), 0);
  assert.equal(invoiceTotal([{ description: 'a', quantity: '3', unit_price_minor: 1001 }]), 3003);
  assert.throws(() => lineTotal(100, '0'));
});

test('invoices: numbering, totals, updates, quote → invoice, status, delete', async () => {
  const db = createTestDb();
  assert.equal(await nextInvoiceNumber(db, 'invoice'), 'INV-0001');
  const id = await createInvoice(db, U, base);
  const get = (i = id) => db.getOptional<Record<string, string | number | null>>('SELECT * FROM invoices WHERE id = ?', [i]);
  const row = (await get())!;
  assert.deepEqual([row.number, row.client_name, row.total_minor, row.status], ['INV-0001', 'Abu Ali', 30000 + 7100, 'draft']);
  assert.deepEqual(parseItems(row.items as string).map((i) => i.unit_price_minor), [20000, 3550]);
  assert.equal(await nextInvoiceNumber(db, 'invoice'), 'INV-0002');

  await updateInvoice(db, id, { ...base, items: [{ description: 'Design', quantity: '1', unitPrice: '200' }] });
  assert.equal((await get())!.total_minor, 20000);
  await setInvoiceStatus(db, id, 'paid');
  await assert.rejects(updateInvoice(db, id, base), code('invoicePaid'));

  const quote = await createInvoice(db, U, { ...base, kind: 'quote' });
  assert.equal((await get(quote))!.number, 'QUO-0001');
  const inv = await quoteToInvoice(db, U, quote);
  const invRow = (await get(inv))!;
  assert.deepEqual([invRow.number, invRow.kind, invRow.total_minor], ['INV-0002', 'invoice', 37100]);
  assert.equal((await get(quote))!.status, 'sent');

  await deleteInvoice(db, inv);
  assert.equal(await get(inv), null);
});

test('invoices: validation', async () => {
  const db = createTestDb();
  const bads: Partial<InvoiceInput>[] = [
    { items: [] }, { clientName: ' ' }, { issueDate: '2026-02-30' },
    { items: [{ description: 'x', quantity: '0', unitPrice: '1' }] },
    { items: [{ description: 'x', quantity: '1', unitPrice: '1.234' }] }, // ILS has 2 decimals
  ];
  for (const bad of bads) await assert.rejects(createInvoice(db, U, { ...base, ...bad }));
});
