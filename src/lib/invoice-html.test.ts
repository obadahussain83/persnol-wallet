/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { invoiceHtml, type InvoiceLabels } from './invoice-html.ts';

const labels: InvoiceLabels = {
  title: 'Invoice', number: 'No.', date: 'Date', due: 'Due', billTo: 'Bill to', description: 'Item', quantity: 'Qty',
  unitPrice: 'Price', amount: 'Amount', total: 'Total', from: 'From',
};

test('invoiceHtml escapes user text, shows lines and the exact total, and sets direction', () => {
  const html = invoiceHtml({
    kind: 'invoice', number: 'INV-0001', client_name: '<script>x</script>', currency: 'ILS', issue_date: '2026-11-16', due_date: null,
    items: [{ description: 'A & B', quantity: '1.5', unit_price_minor: 20000 }, { description: 'C', quantity: '2', unit_price_minor: 3550 }],
    note: null,
  }, labels, { locale: 'en', rtl: true, seller: 'Me' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('₪300.00')); // 1.5 × 200
  assert.ok(html.includes('₪371.00')); // total
  assert.ok(!html.includes('Due:'));
});
