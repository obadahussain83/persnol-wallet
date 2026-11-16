import { useQuery } from '@powersync/react';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TrendChart } from '@/components/charts';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, IconBadge, Screen, SectionTitle, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { type CategorySpend, EXPENSE_BY_CATEGORY_SQL, FLOW_SINCE_SQL, SCOPE_TOTALS_SQL } from '@/db/queries';
import { useMode } from '@/hooks/use-mode';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { monthRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { flowStart, type FlowRow, monthlyFlow } from '@/lib/reports';
import { useUser } from '@/session/session-provider';

type Period = 'month' | 'lastMonth' | 'year';
type Scope = 'all' | 'personal' | 'work';
const TREND_MONTHS = 6;

function periodRange(p: Period, now: Date): [string, string] {
  if (p === 'lastMonth') return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  if (p === 'year') return [new Date(now.getFullYear(), 0, 1).toISOString(), new Date(now.getFullYear() + 1, 0, 1).toISOString()];
  return monthRange(now);
}

export default function Reports() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { userId } = useUser();
  const [period, setPeriod] = useState<Period>('month');
  const [picked, setPicked] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const { isBusiness } = useMode();
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => periodRange(period, now), [period, now]);
  const since = useMemo(() => flowStart(TREND_MONTHS, now), [now]);

  const { data: scopeTotals } = useQuery<{ currency: string; scope: string; income_minor: number; expense_minor: number }>(SCOPE_TOTALS_SQL, range);
  const { data: allSpend } = useQuery<CategorySpend>(EXPENSE_BY_CATEGORY_SQL, range);
  const { data: allFlow } = useQuery<FlowRow>(FLOW_SINCE_SQL, [since]);
  // Work selected = the business's profit & loss; transfers never count.
  const inScope = (s?: string) => scope === 'all' || (s ?? 'personal') === scope;
  const flowRows = allFlow.filter((r) => inScope(r.scope));
  const totals = Object.values(scopeTotals.filter((r) => inScope(r.scope)).reduce<Record<string, { currency: string; income_minor: number; expense_minor: number }>>(
    (acc, r) => {
      const a = (acc[r.currency] ??= { currency: r.currency, income_minor: 0, expense_minor: 0 });
      a.income_minor += r.income_minor;
      a.expense_minor += r.expense_minor;
      return acc;
    }, {}));
  // Rows are split by scope; merge a category's personal and work rows when showing both.
  const spend = Object.values(allSpend.filter((r) => inScope(r.scope)).reduce<Record<string, CategorySpend>>((acc, r) => {
    const k = `${r.category_id}|${r.currency}`;
    acc[k] = acc[k] ? { ...acc[k], total_minor: acc[k].total_minor + r.total_minor } : r;
    return acc;
  }, {})).sort((a, b) => b.total_minor - a.total_minor);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);

  // Currencies are never mixed: every number on this screen is for one currency.
  const currencies = [...new Set([...totals.map((r) => r.currency), ...flowRows.map((r) => r.currency)])].sort();
  const fallback = profile[0]?.primary_currency ?? 'ILS';
  const currency = picked && currencies.includes(picked) ? picked
    : currencies.includes(fallback) ? fallback : (currencies[0] ?? fallback);

  const money = (minor: number) => formatMoney(minor, currency, i18n.language);
  const sum = totals.find((r) => r.currency === currency) ?? { income_minor: 0, expense_minor: 0 };
  const net = sum.income_minor - sum.expense_minor;
  const cats = spend.filter((r) => r.currency === currency);
  const catTotal = cats.reduce((a, r) => a + r.total_minor, 0);
  const flow = monthlyFlow(flowRows, currency, TREND_MONTHS, now);

  return (
    <Screen title={t('reports.title')}>
      <Segmented<Period> value={period} onChange={setPeriod}
        options={[{ value: 'month', label: t('tx.thisMonth') }, { value: 'lastMonth', label: t('tx.lastMonth') }, { value: 'year', label: t('tx.thisYear') }]} />
      {isBusiness && (
        <Segmented<Scope> value={scope} onChange={setScope}
          options={[{ value: 'all', label: t('common.all') }, { value: 'personal', label: t('tx.personal') }, { value: 'work', label: t('tx.work') }]} />
      )}
      {currencies.length > 1 && (
        <Segmented value={currency} onChange={setPicked} options={currencies.map((c) => ({ value: c, label: c }))} />
      )}

      <View style={styles.summary}>
        {[
          { label: t('tx.income'), value: sum.income_minor, color: theme.income },
          { label: t('tx.expense'), value: sum.expense_minor, color: theme.expense },
          { label: scope === 'work' ? t('reports.profit') : t('reports.net'), value: net, color: net < 0 ? theme.expense : theme.income },
        ].map((s) => (
          <Card key={s.label} style={styles.stat}>
            <ThemedText type="small" themeColor="textSecondary">{s.label}</ThemedText>
            <ThemedText type="smallBold" style={{ color: s.color }} numberOfLines={1} adjustsFontSizeToFit>{money(s.value)}</ThemedText>
          </Card>
        ))}
      </View>

      <SectionTitle>{t('reports.byCategory')}</SectionTitle>
      {cats.length === 0 ? (
        <EmptyState icon="chart-pie" title={t('reports.noExpenses')} />
      ) : (
        <Card>
          {cats.map((c) => {
            const share = c.total_minor / catTotal;
            const color = c.category_color ?? theme.primary;
            return (
              <View key={c.category_id ?? 'none'} style={styles.catRow}>
                <View style={styles.row}>
                  <IconBadge icon={c.category_icon ?? 'tag'} color={color} size={32} />
                  <ThemedText style={styles.flex} numberOfLines={1}>
                    {c.category_id ? categoryLabel({ key: c.category_key, name: c.category_name }) : t('reports.uncategorized')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{Math.round(share * 100)}%</ThemedText>
                  <ThemedText type="smallBold">{money(c.total_minor)}</ThemedText>
                </View>
                <ProgressBar ratio={share} color={color} height={6} />
              </View>
            );
          })}
        </Card>
      )}

      <SectionTitle>{t('reports.trend')}</SectionTitle>
      <Card>
        <TrendChart flow={flow} currency={currency} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summary: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one },
  catRow: { gap: Spacing.one, paddingVertical: Spacing.one },
});
