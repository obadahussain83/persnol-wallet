import { CURRENCIES } from './accounts.ts';
import { type Db, nowIso } from './db.ts';

// Free, keyless daily rates (USD base). Only the base currency is sent; nothing about the user.
export const FX_URL = 'https://open.er-api.com/v6/latest/USD';
/** Automatic rates older than this are refreshed. */
export const FX_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type FxRow = { id: string; per_usd: string; base: string | null; fetched_at: string; manual: number };
export type Rates = Record<string, number>; // units per 1 USD

export async function loadRates(db: Db): Promise<FxRow[]> {
  return db.getAll<FxRow>('SELECT id, per_usd, base, fetched_at, manual FROM fx_rates');
}

/** Units per 1 USD for every known currency; manual rows are resolved through their base. */
export function ratesOf(rows: readonly FxRow[]): Rates {
  const rates: Rates = Object.fromEntries(rows.filter((r) => !r.manual).map((r) => [r.id, Number(r.per_usd)]));
  for (const r of rows) {
    const base = r.base ? rates[r.base] : undefined;
    if (r.manual && base) rates[r.id] = base / Number(r.per_usd);
  }
  return rates;
}

/**
 * Rate as a decimal string for `convert()`: 1 unit of `from` = N units of `to`. Null when either rate is unknown.
 * shortcut: computed in floating point and rounded to 8 places; plenty for display totals, not for bookkeeping.
 */
export function crossRate(rates: Rates, from: string, to: string): string | null {
  if (from === to) return '1';
  const a = rates[from], b = rates[to];
  if (!a || !b) return null;
  return (b / a).toFixed(8);
}

async function upsert(db: Db, code: string, perUsd: string, base: string | null, now: string) {
  const manual = base ? 1 : 0;
  if (await db.getOptional('SELECT 1 AS x FROM fx_rates WHERE id = ?', [code])) {
    await db.execute('UPDATE fx_rates SET per_usd = ?, base = ?, fetched_at = ?, manual = ? WHERE id = ?', [perUsd, base, now, manual, code]);
  } else {
    await db.execute('INSERT INTO fx_rates (id, per_usd, base, fetched_at, manual) VALUES (?, ?, ?, ?, ?)', [code, perUsd, base, now, manual]);
  }
}

/**
 * Downloads fresh rates when any automatic one is missing or stale (or `force`). Manual rates are kept.
 * Returns true when it fetched. Network or format errors are thrown to the caller.
 */
export async function refreshRates(db: Db, fetchFn: typeof fetch = fetch, now = new Date(), force = false): Promise<boolean> {
  const rows = await loadRates(db);
  const byCode = new Map(rows.map((r) => [r.id, r]));
  const stale = CURRENCIES.some((c) => {
    const r = byCode.get(c);
    return !r || (!r.manual && now.getTime() - Date.parse(r.fetched_at) > FX_MAX_AGE_MS);
  });
  if (!stale && !force) return false;
  const res = await fetchFn(FX_URL);
  if (!res.ok) throw new Error(`rates HTTP ${res.status}`);
  const body = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
  if (body.result !== 'success' || !body.rates) throw new Error('rates: unexpected response');
  const at = now.toISOString();
  for (const c of CURRENCIES) {
    const v = body.rates[c];
    if (typeof v !== 'number' || !(v > 0)) continue;
    if (byCode.get(c)?.manual) continue;
    await upsert(db, c, String(v), null, at);
  }
  return true;
}

/** Stores a user-typed rate given as "1 `code` = `value` `primary`". */
export async function setManualRate(db: Db, code: string, primary: string, value: number): Promise<void> {
  if (!(value > 0) || code === primary) throw new Error('invalid manual rate');
  await upsert(db, code, String(value), primary, nowIso());
}

/** Drops a manual rate; the next refresh fills the automatic one back in. */
export async function clearManualRate(db: Db, code: string): Promise<void> {
  await db.execute('DELETE FROM fx_rates WHERE id = ? AND manual = 1', [code]);
}
