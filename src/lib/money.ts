// Money is always an integer count of minor units (e.g. agorot, cents, fils).
// Floats never hold a monetary value; BigInt is used where products could overflow.

export const CURRENCY_DECIMALS = { ILS: 2, USD: 2, EUR: 2, JOD: 3 } as const;
export type CurrencyCode = keyof typeof CURRENCY_DECIMALS;

export function decimalsOf(currency: string): number {
  const d = (CURRENCY_DECIMALS as Record<string, number>)[currency];
  if (d === undefined) throw new Error(`Unsupported currency: ${currency}`);
  return d;
}

function assertMinor(n: number): void {
  if (!Number.isSafeInteger(n)) throw new Error(`Not a safe integer amount: ${n}`);
}

/** Parse user input like "50", "12.5", "-0.125" into minor units. Rejects excess precision. */
export function parseAmount(input: string, currency: string): number {
  const d = decimalsOf(currency);
  // Accept Arabic-Indic / Persian digits and the Arabic decimal/thousands separators from Arabic keyboards.
  const normalized = input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
  const m = /^\s*(-)?(\d+)(?:[.,](\d*))?\s*$/.exec(normalized);
  if (!m) throw new Error(`Invalid amount: "${input}"`);
  const [, sign, whole, frac = ''] = m;
  if (frac.length > d) throw new Error(`${currency} allows at most ${d} decimal places`);
  const minor = Number(BigInt(whole + frac.padEnd(d, '0')));
  assertMinor(minor);
  return sign && minor !== 0 ? -minor : minor;
}

/** Exact decimal string, e.g. toDecimalString(12345, 'JOD') === "12.345". */
export function toDecimalString(minor: number, currency: string): string {
  assertMinor(minor);
  const d = decimalsOf(currency);
  const abs = String(Math.abs(minor)).padStart(d + 1, '0');
  const s = d === 0 ? abs : `${abs.slice(0, -d)}.${abs.slice(-d)}`;
  return minor < 0 ? `-${s}` : s;
}

export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  const d = decimalsOf(currency);
  // Display only: minor / 10^d is exact to well beyond any realistic personal balance.
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(minor / 10 ** d);
}

/**
 * Convert using a decimal-string rate ("1 unit of `from` = rate units of `to`").
 * Rounds half away from zero. The rate string is what gets stored with the transaction.
 */
export function convert(minor: number, from: string, to: string, rate: string): number {
  assertMinor(minor);
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!m) throw new Error(`Invalid rate: "${rate}"`);
  const rateScale = (m[2] ?? '').length;
  const rateInt = BigInt(m[1] + (m[2] ?? ''));
  const num = BigInt(minor) * rateInt * 10n ** BigInt(decimalsOf(to));
  const den = 10n ** BigInt(rateScale + decimalsOf(from));
  const q = num / den;
  const r = num % den;
  const rounded = 2n * (r < 0n ? -r : r) >= den ? q + (num < 0n ? -1n : 1n) : q;
  const out = Number(rounded);
  assertMinor(out);
  return out;
}

export function sumMinor(values: readonly number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  assertMinor(total);
  return total;
}
