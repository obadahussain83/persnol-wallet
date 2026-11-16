import { crossRate, type Rates } from '../data/fx.ts';
import { convert, sumMinor } from './money.ts';

export type NetWorth = { balances: number; owedToMe: number; iOwe: number; net: number };

/**
 * Balances plus money owed to me minus money I owe, all converted to `primary` (approximate, current rates).
 * Null when a needed rate is missing: better no figure than a wrong one.
 */
export function netWorth(
  balances: readonly { currency: string; total: number }[],
  debts: readonly { direction: 'owed_to_me' | 'i_owe'; currency: string; amount_minor: number }[],
  rates: Rates,
  primary: string,
): NetWorth | null {
  const currencies = [...balances.map((b) => b.currency), ...debts.map((d) => d.currency)];
  if (!currencies.every((c) => crossRate(rates, c, primary))) return null;
  const toPrimary = (minor: number, c: string) => convert(minor, c, primary, crossRate(rates, c, primary)!);
  const b = sumMinor(balances.map((x) => toPrimary(x.total, x.currency)));
  const owedToMe = sumMinor(debts.filter((d) => d.direction === 'owed_to_me').map((d) => toPrimary(d.amount_minor, d.currency)));
  const iOwe = sumMinor(debts.filter((d) => d.direction === 'i_owe').map((d) => toPrimary(d.amount_minor, d.currency)));
  return { balances: b, owedToMe, iOwe, net: b + owedToMe - iOwe };
}
