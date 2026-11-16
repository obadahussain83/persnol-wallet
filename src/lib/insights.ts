export type CatTotal = { id: string; label: string; total: number };
export type Insight =
  | { key: 'spendUp' | 'spendDown'; pct: number }
  | { key: 'categoryUp'; label: string; pct: number }
  | { key: 'topCategory'; label: string; pct: number }
  | { key: 'saved'; pct: number }
  | { key: 'overspent' }
  | { key: 'overBudget'; count: number };

/** Ignore swings smaller than this, so the summary only says things worth reading. */
const MIN_CHANGE_PCT = 10;

/**
 * Up to three short observations about this month so far, compared with the same days of last month.
 * Amounts are minor units in one currency. Order: overall spending, biggest category jump, savings/budgets, top category.
 */
export function monthInsights(input: {
  thisCats: readonly CatTotal[]; lastCats: readonly CatTotal[]; income: number; expense: number; overBudgets: number;
}): Insight[] {
  const out: Insight[] = [];
  const thisTotal = input.thisCats.reduce((a, c) => a + c.total, 0);
  const lastTotal = input.lastCats.reduce((a, c) => a + c.total, 0);
  if (lastTotal > 0 && thisTotal > 0) {
    const pct = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
    if (Math.abs(pct) >= MIN_CHANGE_PCT) out.push({ key: pct > 0 ? 'spendUp' : 'spendDown', pct: Math.abs(pct) });
  }
  // Biggest increase by amount, among categories spent in both periods.
  const jumps = input.thisCats.flatMap((c) => {
    const before = input.lastCats.find((l) => l.id === c.id)?.total ?? 0;
    return before > 0 && c.total > before ? [{ c, diff: c.total - before, pct: Math.round(((c.total - before) / before) * 100) }] : [];
  }).filter((j) => j.pct >= 20).sort((a, b) => b.diff - a.diff);
  if (jumps[0]) out.push({ key: 'categoryUp', label: jumps[0].c.label, pct: jumps[0].pct });
  if (input.overBudgets > 0) out.push({ key: 'overBudget', count: input.overBudgets });
  else if (input.income > 0 && input.expense > input.income) out.push({ key: 'overspent' });
  else if (input.income > 0) {
    const pct = Math.round(((input.income - input.expense) / input.income) * 100);
    if (pct > 0) out.push({ key: 'saved', pct });
  }
  const top = [...input.thisCats].sort((a, b) => b.total - a.total)[0];
  if (top && thisTotal > 0 && out.length < 3) out.push({ key: 'topCategory', label: top.label, pct: Math.round((top.total / thisTotal) * 100) });
  return out.slice(0, 3);
}
