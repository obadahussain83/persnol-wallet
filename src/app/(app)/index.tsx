import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AccountCard } from '@/components/account-card';
import { BalanceHero } from '@/components/balance-hero';
import { Reveal } from '@/components/ui/motion';
import { SyncStatus } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { TransactionItem } from '@/components/transaction-item';
import { Button, Card, EmptyState, IconBadge, Screen, SectionTitle } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import {
  ACCOUNT_BALANCES_SQL, type AccountBalance, OUTSTANDING_DEBTS_SQL, type OutstandingDebt, SCOPE_TOTALS_SQL,
  TRANSACTIONS_LIST_SQL, type TransactionListRow,
} from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { monthRange } from '@/lib/dates';
import { formatMoney, sumMinor } from '@/lib/money';
import { useUser } from '@/session/session-provider';

type Totals = { currency: string; scope: 'personal' | 'work'; income_minor: number; expense_minor: number };

// Net worth across currencies needs exchange rates (Phase 4); totals are shown per currency.
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { userId } = useUser();
  const range = useMemo(() => monthRange(), []);
  const { data: accounts } = useQuery<AccountBalance>(ACCOUNT_BALANCES_SQL);
  const { data: month } = useQuery<Totals>(SCOPE_TOTALS_SQL, range);
  const { data: recent } = useQuery<TransactionListRow>(TRANSACTIONS_LIST_SQL, [6]);
  const { data: debts } = useQuery<OutstandingDebt>(OUTSTANDING_DEBTS_SQL);
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
  monthRow: { flexDirection: 'row', gap: Spacing.three },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stack: { gap: Spacing.three },
  cta: { alignSelf: 'flex-start' }, // hugs its label; a full-width slab would outweigh the balance above it
  // 150 lets the two directions sit side by side on a phone.
  debt: { flexGrow: 1, flexBasis: 150, minWidth: 0, padding: Spacing.three },
  debtHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  debtLabel: { flex: 1 },
  big: { fontSize: 24, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
