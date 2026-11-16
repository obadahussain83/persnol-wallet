import { invoiceTotal, lineTotal, type InvoiceItem } from '../data/invoices.ts';
import { formatMoney } from './money.ts';

export type PrintableInvoice = {
  kind: 'invoice' | 'quote'; number: string; client_name: string; currency: string; issue_date: string; due_date: string | null;
  items: InvoiceItem[]; note: string | null;
};
export type InvoiceLabels = {
  title: string; number: string; date: string; due: string; billTo: string; description: string; quantity: string;
  unitPrice: string; amount: string; total: string; from: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained, print-ready HTML (A4) for an invoice or quote. All user text is escaped. */
export function invoiceHtml(inv: PrintableInvoice, l: InvoiceLabels, opts: { locale: string; rtl: boolean; seller: string }): string {
  const money = (m: number) => esc(formatMoney(m, inv.currency, opts.locale));
  const rows = inv.items.map((it) => `<tr><td>${esc(it.description)}</td><td class="n">${esc(it.quantity)}</td>`
    + `<td class="n">${money(it.unit_price_minor)}</td><td class="n">${money(lineTotal(it.unit_price_minor, it.quantity))}</td></tr>`).join('');
  return `<!doctype html><html lang="${esc(opts.locale)}" dir="${opts.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${esc(inv.number)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; color: #111; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  h1 { margin: 0; font-size: 28px; letter-spacing: .5px; }
  .muted { color: #555; font-size: 13px; }
  .meta { text-align: end; font-size: 13px; line-height: 1.7; }
  .to { margin: 20px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: start; border-bottom: 1px solid #999; padding: 8px 6px; font-weight: 600; }
  td { border-bottom: 1px solid #e5e5e5; padding: 8px 6px; vertical-align: top; }
  .n { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .total td { border: 0; font-weight: 700; font-size: 16px; padding-top: 14px; }
  .note { margin-top: 24px; font-size: 13px; white-space: pre-wrap; }
</style></head><body>
<header>
  <div><h1>${esc(l.title)}</h1><div class="muted">${esc(l.from)}: ${esc(opts.seller)}</div></div>
  <div class="meta">${esc(l.number)}: <b>${esc(inv.number)}</b><br>${esc(l.date)}: ${esc(inv.issue_date)}${inv.due_date ? `<br>${esc(l.due)}: ${esc(inv.due_date)}` : ''}</div>
</header>
<div class="to"><span class="muted">${esc(l.billTo)}</span><br><b>${esc(inv.client_name)}</b></div>
<table><thead><tr><th>${esc(l.description)}</th><th class="n">${esc(l.quantity)}</th><th class="n">${esc(l.unitPrice)}</th><th class="n">${esc(l.amount)}</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr class="total"><td colspan="3">${esc(l.total)}</td><td class="n">${money(invoiceTotal(inv.items))}</td></tr></tfoot></table>
${inv.note ? `<div class="note">${esc(inv.note)}</div>` : ''}
</body></html>`;
}
