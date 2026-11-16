export type FlowRow = { type: string; currency: string; scope?: string; amount_minor: number; occurred_at: string };
export type MonthFlow = { start: Date; income: number; expense: number };

/** The last `months` local calendar months (oldest first) with income/expense totals for one currency. */
export function monthlyFlow(rows: readonly FlowRow[], currency: string, months: number, now = new Date()): MonthFlow[] {
  const out: MonthFlow[] = [];
  for (let i = months - 1; i >= 0; i--) out.push({ start: new Date(now.getFullYear(), now.getMonth() - i, 1), income: 0, expense: 0 });
  const first = out[0].start;
  for (const r of rows) {
    if (r.currency !== currency) continue;
    const d = new Date(r.occurred_at);
    const idx = (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth();
    if (idx < 0 || idx >= months) continue;
    if (r.type === 'income') out[idx].income += r.amount_minor;
    else if (r.type === 'expense') out[idx].expense += r.amount_minor;
  }
  return out;
}

/** Since-date for `monthlyFlow`'s window. */
export function flowStart(months: number, now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString();
}
