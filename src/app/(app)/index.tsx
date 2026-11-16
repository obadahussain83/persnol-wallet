import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AccountCard } from '@/components/account-card';
import { BalanceHero } from '@/components/balance-hero';
import { Reveal } from '@/components/ui/motion';
import { SyncStatus } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { TransactionItem } from '@/components/transaction-item';
import { Button, Card, EmptyState, IconBadge, Screen, SectionTitle } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { daysUntil, DUE_SOON_DAYS } from '@/data/cheques';
import { crossRate, type FxRow, ratesOf } from '@/data/fx';
import {
  ACCOUNT_BALANCES_SQL, type AccountBalance, OUTSTANDING_DEBTS_SQL, type OutstandingDebt, SCOPE_TOTALS_SQL,
  TRANSACTIONS_LIST_SQL, type TransactionListRow,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, monthRange } from '@/lib/dates';
import { convert, formatMoney, sumMinor } from '@/lib/money';
import { useUser } from '@/session/session-provider';

type Totals = { currency: string; scope: 'personal' | 'work'; income_minor: number; expense_minor: number };

// Balances are shown per currency; with more than one, an approximate total in the primary currency is added.
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { userId } = useUser();
  const range = useMemo(() => monthRange(), []);
  const { data: accounts } = useQuery<AccountBalance>(ACCOUNT_BALANCES_SQL);
  const { data: month } = useQuery<Totals>(SCOPE_TOTALS_SQL, range);
  const { data: recent } = useQuery<TransactionListRow>(TRANSACTIONS_LIST_SQL, [6]);
  const { data: debts } = useQuery<OutstandingDebt>(OUTSTANDING_DEBTS_SQL);
  const { data: fxRows } = useQuery<FxRow>('SELECT id, per_usd, base, fetched_at, manual FROM fx_rates');
  const soonKey = useMemo(() => { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + DUE_SOON_DAYS, 12).toISOString()); }, []);
  const { data: dueCheques } = useQuery<{ id: string; direction: 'incoming' | 'outgoing'; person: string; amount_minor: number; currency: string; due_date: string }>(
    `SELECT id, direction, person, amount_minor, currency, due_date FROM cheques
     WHERE status = 'pending' AND due_date <= ? ORDER BY due_date LIMIT 5`, [soonKey]);
  const { data: profile } = useQuery<{ display_name: string | null; primary_currency: string }>(
    'SELECT display_name, primary_currency FROM profiles WHERE id = ?', [userId]);

  const money = (minor: number, currency: string) => formatMoney(minor, currency, i18n.language);
  const name = profile[0]?.display_name;
  const personal: Totals[] = month.filter((m) => m.scope === 'personal');
  const workRows = month.filter((m) => m.scope === 'work'); // shown only once there is work activity this month
  // Always shown: with nothing outstanding, both directions read zero in the primary currency.
  const debtRows: OutstandingDebt[] = debts.length ? debts : (['owed_to_me', 'i_owe'] as const).map((direction) => (
    { direction, currency: profile[0]?.primary_currency ?? 'ILS', amount_minor: 0 }));
  const balances =[...new Set(accounts.map((a) => a.currency))].map((c) => ({
    currency: c,
    total: sumMinor(accounts.filter((a) => a.currency === c).map((a) => a.balance_minor)),
  }));
  const primary = profile[0]?.primary_currency ?? 'ILS';
  const rates = ratesOf(fxRows);
  // Null until every needed rate is known (first launch offline): better no total than a wrong one.
  const combined = balances.length > 1 && balances.every((b) => crossRate(rates, b.currency, primary))
    ? sumMinor(balances.map((b) => convert(b.total, b.currency, primary, crossRate(rates, b.currency, primary)!)))
    : null;
  // Personal totals ride on the hero of their currency; a card is only needed for work, or a currency with no hero.
  const monthRows = [...personal.filter((p) => !balances.some((b) => b.currency === p.currency)), ...workRows];

  return (
    <Screen title={name ? t('dashboard.greeting', { name }) : t('dashboard.greetingNoName')} actions={<SyncStatus />}>
      {accounts.length === 0 ? (
        <EmptyState icon="wallet" title={t('dashboard.emptyTitle')} hint={t('dashboard.emptyHint')}
          action={<Button label={t('accounts.new')} icon="plus" onPress={() => router.push('/accounts/new')} />} />
      ) : (
        <>
          <Reveal style={styles.grid}>
            {balances.map((x) => {
              const m = personal.find((p) => p.currency === x.currency);
              return (
                <BalanceHero key={x.currency} testID={`total-${x.currency}`} currency={x.currency} totalMinor={x.total}
                  incomeMinor={m?.income_minor ?? 0} expenseMinor={m?.expense_minor ?? 0} />
              );
            })}
          </Reveal>
          {combined !== null && (
            <Card testID="combined-total">
              <ThemedText type="small" themeColor="textSecondary">{t('dashboard.combined', { currency: primary })}</ThemedText>
              <ThemedText style={styles.statValue}>≈ {money(combined, primary)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('dashboard.combinedHint')}</ThemedText>
            </Card>
          )}
          <Reveal index={1} style={styles.cta}><Button label={t('tx.add')} icon="plus" onPress={() => router.push('/add')} /></Reveal>

          {monthRows.length ? (
            <Reveal index={2} style={styles.stack}>
              <SectionTitle>{t('dashboard.thisMonth')}</SectionTitle>
              {monthRows.map((m) => {
                const net = m.income_minor - m.expense_minor;
                const work = m.scope === 'work';
                return (
                  <Card key={`${m.scope}-${m.currency}`} testID={`month-${m.scope}-${m.currency}`}>
                    <ThemedText type="smallBold" style={{ color: work ? theme.primary : theme.textSecondary }}>
                      {work ? t('dashboard.work') : t('dashboard.personal')}{monthRows.length > 1 ? ` · ${m.currency}` : ''}
                    </ThemedText>
                    <View style={styles.monthRow}>
                      <Stat label={t('dashboard.income')} value={money(m.income_minor, m.currency)} color={theme.income} />
                      <Stat label={t('dashboard.expenses')} value={money(m.expense_minor, m.currency)} color={theme.expense} />
                      <Stat label={work ? t('dashboard.workProfit') : t('dashboard.net')} value={money(net, m.currency)}
                        color={net < 0 ? theme.expense : work ? theme.income : theme.text} />
                    </View>
                  </Card>
                );
              })}
            </Reveal>
          ) : null}
        </>
      )}

      {dueCheques.length ? (
        <Reveal index={3} style={styles.stack}>
          <View style={styles.sectionRow}>
            <SectionTitle>{t('cheques.dueSoon')}</SectionTitle>
            <Button variant="ghost" label={t('common.viewAll')} onPress={() => router.push('/cheques')} />
          </View>
          <Card>
            {dueCheques.map((c) => {
              const d = daysUntil(c.due_date);
              const incoming = c.direction === 'incoming';
              return (
                <Pressable key={c.id} accessibilityRole="link" onPress={() => router.push(`/cheques/${c.id}`)} style={styles.chequeRow}>
                  <IconBadge icon={incoming ? 'arrow-down-left' : 'arrow-up-right'} color={incoming ? theme.income : theme.expense} size={32} />
                  <ThemedText style={styles.flex} numberOfLines={1}>{c.person}</ThemedText>
                  <ThemedText type="small" style={{ color: d < 0 ? theme.danger : theme.warning }}>
                    {d < 0 ? t('cheques.overdue', { count: -d }) : d === 0 ? t('cheques.dueToday') : t('cheques.dueIn', { count: d })}
                  </ThemedText>
                  <ThemedText type="smallBold">{money(c.amount_minor, c.currency)}</ThemedText>
                </Pressable>
              );
            })}
          </Card>
        </Reveal>
      ) : null}

      {accounts.length ? (
        <Reveal index={3} style={styles.stack}>
          <View style={styles.sectionRow}>
            <SectionTitle>{t('debts.title')}</SectionTitle>
            <Button variant="ghost" label={t('common.viewAll')} onPress={() => router.push('/debts')} />
          </View>
          <View style={styles.grid}>
            {debtRows.map((debt) => {
              const owedToMe = debt.direction === 'owed_to_me';
              const color = owedToMe ? theme.income : theme.expense;
              return (
                <Card key={`${debt.direction}-${debt.currency}`} style={styles.debt} glow={color}
                  testID={`debt-${debt.direction}-${debt.currency}`} onPress={() => router.push('/debts')}>
                  <View style={styles.debtHead}>
                    <IconBadge icon={owedToMe ? 'arrow-down-left' : 'arrow-up-right'} color={color} size={36} />
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.debtLabel}>
                      {t(owedToMe ? 'debts.owedToMe' : 'debts.iOwe')}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.big, { color }]} numberOfLines={1}>{money(debt.amount_minor, debt.currency)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('debts.outstanding')} · {debt.currency}</ThemedText>
                </Card>
              );
            })}
          </View>
        </Reveal>
      ) : null}

      {accounts.length ? (
        <Reveal index={4} style={styles.stack}>
          <View style={styles.sectionRow}>
            <SectionTitle>{t('dashboard.recent')}</SectionTitle>
            {recent.length ? <Button variant="ghost" label={t('common.viewAll')} onPress={() => router.push('/transactions')} /> : null}
          </View>
          {recent.length ? (
            <Card style={{ padding: 4, gap: 0 }}>
              {recent.map((r) => <TransactionItem key={r.id} tx={r} onPress={() => router.push('/transactions')} />)}
            </Card>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">{t('tx.emptyHint')}</ThemedText>
          )}

          <SectionTitle>{t('dashboard.accounts')}</SectionTitle>
          {accounts.map((a) => <AccountCard key={a.id} account={a} onPress={() => router.push(`/accounts/${a.id}`)} />)}
        </Reveal>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chequeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  monthRow: { flexDirection: 'row', gap: Spacing.three },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stack: { gap: Spacing.three },
  cta: { alignSelf: 'stretch' }, // full width, like every other primary button in the app
  // 150 lets the two directions sit side by side on a phone.
  debt: { flexGrow: 1, flexBasis: 150, minWidth: 0, padding: Spacing.three },
  debtHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  debtLabel: { flex: 1 },
  big: { fontSize: 24, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
