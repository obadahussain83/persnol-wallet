import { z } from 'zod';

import { dayKey, parseDay } from '../lib/dates.ts';
import { parseAmount } from '../lib/money.ts';
import { CURRENCIES } from './accounts.ts';
import { type Db, DomainError, newId, nowIso } from './db.ts';

export const INVOICE_KINDS = ['invoice', 'quote'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceItem = { description: string; quantity: string; unit_price_minor: number };

/** Quantities allow up to 3 decimals (e.g. 1.5 hours); parsed as thousandths. */
function quantityMilli(q: string): number {
  const milli = parseAmount(q, 'JOD'); // JOD has 3 decimals: reuse the exact decimal parser
  if (milli <= 0) throw new Error('quantity must be positive');
  return milli;
}

/** unit × quantity, rounded half away from zero, in minor units. */
export function lineTotal(unitMinor: number, quantity: string): number {
  const num = BigInt(unitMinor) * BigInt(quantityMilli(quantity));
  const q = num / 1000n, r = num % 1000n;
  return Number(2n * (r < 0n ? -r : r) >= 1000n ? q + (num < 0n ? -1n : 1n) : q);
}

export function invoiceTotal(items: readonly InvoiceItem[]): number {
  return items.reduce((a, it) => a + lineTotal(it.unit_price_minor, it.quantity), 0);
}

const validQuantity = (q: string) => {
  try {
    quantityMilli(q);
    return true;
  } catch {
    return false;
  }
};

const itemSchema = z.object({
  description: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  quantity: z.string().trim().refine(validQuantity, 'invalidQuantity'),
  unitPrice: z.string().trim(),
});

// Messages are i18n keys under `errors.`.
export const invoiceInputSchema = z
  .object({
    kind: z.enum(INVOICE_KINDS),
    contactId: z.string().default(''),
    clientName: z.string().trim().min(1, 'required').max(100, 'tooLong'),
    currency: z.enum(CURRENCIES),
    issueDate: z.string().refine((d) => parseDay(d) !== null, 'invalidDate'),
    dueDate: z.string().trim().refine((d) => !d || parseDay(d) !== null, 'invalidDate').default(''),
    items: z.array(itemSchema).min(1, 'noItems'),
    note: z.string().trim().max(1000, 'tooLong').default(''),
  })
  .superRefine((v, ctx) => {
    v.items.forEach((it, i) => {
      try {
        if (parseAmount(it.unitPrice, v.currency) < 0) throw new Error();
      } catch {
        ctx.addIssue({ code: 'custom', path: ['items', i, 'unitPrice'], message: 'invalidAmount' });
      }
    });
  });
export type InvoiceInput = z.input<typeof invoiceInputSchema>;

function toRow(input: InvoiceInput) {
  const v = invoiceInputSchema.parse(input);
  const items: InvoiceItem[] = v.items.map((it) => ({
    description: it.description, quantity: it.quantity, unit_price_minor: parseAmount(it.unitPrice, v.currency),
  }));
  const day = (d: string) => dayKey(parseDay(d)!.toISOString());
  return {
    kind: v.kind, contactId: v.contactId || null, clientName: v.clientName, currency: v.currency, issueDate: day(v.issueDate),
    dueDate: v.dueDate ? day(v.dueDate) : null, items: JSON.stringify(items), total: invoiceTotal(items), note: v.note || null,
  };
}

/** Next number per kind, e.g. INV-0008 after INV-0007. shortcut: two offline devices can pick the same number. */
export async function nextInvoiceNumber(db: Db, kind: InvoiceKind): Promise<string> {
  const prefix = kind === 'invoice' ? 'INV-' : 'QUO-';
  const rows = await db.getAll<{ number: string }>('SELECT number FROM invoices WHERE kind = ?', [kind]);
  const max = rows.reduce((m, r) => Math.max(m, Number(/(\d+)$/.exec(r.number)?.[1] ?? 0)), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export async function createInvoice(db: Db, userId: string, input: InvoiceInput): Promise<string> {
  const r = toRow(input);
  const id = await newId(db);
  const now = nowIso();
  const number = await nextInvoiceNumber(db, r.kind);
  await db.execute(
    `INSERT INTO invoices (id, user_id, kind, number, contact_id, client_name, currency, issue_date, due_date, items, total_minor, note, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [id, userId, r.kind, number, r.contactId, r.clientName, r.currency, r.issueDate, r.dueDate, r.items, r.total, r.note, now, now],
  );
  return id;
}

export async function updateInvoice(db: Db, id: string, input: InvoiceInput): Promise<void> {
  const r = toRow(input);
  const cur = await db.getOptional<{ status: string }>('SELECT status FROM invoices WHERE id = ?', [id]);
  if (!cur) throw new DomainError('notFound');
  if (cur.status === 'paid') throw new DomainError('invoicePaid'); // the recorded income would no longer match
  await db.execute(
    `UPDATE invoices SET contact_id = ?, client_name = ?, currency = ?, issue_date = ?, due_date = ?, items = ?, total_minor = ?, note = ?, updated_at = ?
     WHERE id = ?`,
    [r.contactId, r.clientName, r.currency, r.issueDate, r.dueDate, r.items, r.total, r.note, nowIso(), id],
  );
}

export async function setInvoiceStatus(db: Db, id: string, status: InvoiceStatus): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE invoices SET status = ?, status_at = ?, updated_at = ? WHERE id = ?',
    [status, status === 'draft' ? null : now, now, id]);
}

/** Turns an accepted quote into a new draft invoice with the same client and items; returns its id. */
export async function quoteToInvoice(db: Db, userId: string, quoteId: string): Promise<string> {
  const q = await db.getOptional<Record<string, string | number | null>>("SELECT * FROM invoices WHERE id = ? AND kind = 'quote'", [quoteId]);
  if (!q) throw new DomainError('notFound');
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO invoices (id, user_id, kind, number, contact_id, client_name, currency, issue_date, due_date, items, total_minor, note, status, created_at, updated_at)
     VALUES (?, ?, 'invoice', ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'draft', ?, ?)`,
    [id, userId, await nextInvoiceNumber(db, 'invoice'), q.contact_id, q.client_name, q.currency, dayKey(now), q.items, q.total_minor, q.note, now, now],
  );
  await setInvoiceStatus(db, quoteId, 'sent');
  return id;
}

export async function deleteInvoice(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM invoices WHERE id = ?', [id]);
}

export function parseItems(json: string | null): InvoiceItem[] {
  try {
    const v = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
