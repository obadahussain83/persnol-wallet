import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { TransactionItem } from '@/components/transaction-item';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button, Card, ChoiceGrid, EmptyState, IconButton, Screen, SectionTitle, Segmented, TextField } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { deleteTransaction } from '@/data/transactions';
import { TRANSACTIONS_LIST_SQL, type TransactionListRow } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { dayKey, dayRange, monthRange } from '@/lib/dates';
import { useUser } from '@/session/session-provider';

type Kind = 'all' | 'expense' | 'income' | 'transfer';
type Period = 'all' | 'month' | 'lastMonth' | 'year' | 'custom';
const ALL = '';

function periodRange(p: Period): [string, string] | null {
  const now = new Date();
  if (p === 'month') return monthRange(now);
  if (p === 'lastMonth') return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  if (p === 'year') return [new Date(now.getFullYear(), 0, 1).toISOString(), new Date(now.getFullYear() + 1, 0, 1).toISOString()];
  return null;
}

// shortcut: newest 500 only, filtered in memory; add paging + SQL filters (Phase 4) when histories get long.
export default function Transactions() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db } = useUser();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'personal' | 'work'>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [accountId, setAccountId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [showFilters, setShowFilters] = useState(false);
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const { data } = useQuery<TransactionListRow>(TRANSACTIONS_LIST_SQL, [500]);

  // Choices come from the loaded rows, so only accounts/categories that have transactions are offered.
  const accountNames = new Map<string, string>();
  const categoryNames = new Map<string, string>();
  for (const r of data) {
    accountNames.set(r.account_id, r.account_name);
    if (r.to_account_id && r.to_account_name) accountNames.set(r.to_account_id, r.to_account_name);
    if (r.category_id) categoryNames.set(r.category_id, categoryLabel({ key: r.category_key, name: r.category_name }));
  }

  const customRange = period === 'custom' ? dayRange(fromDay, toDay) : null;
  // An incomplete custom range doesn't filter yet; the hint below says why.
  const range = period === 'custom' ? customRange : periodRange(period);
  const needle = q.trim().toLowerCase();
  const rows = data
    .filter((r) => scope === 'all' || (r.scope ?? 'personal') === scope)
    .filter((r) => kind === 'all' || r.type === kind)
    .filter((r) => !range || (r.occurred_at >= range[0] && r.occurred_at < range[1]))
    .filter((r) => accountId === ALL || r.account_id === accountId || r.to_account_id === accountId)
    .filter((r) => categoryId === ALL || r.category_id === categoryId)
    .filter((r) => !needle ||
      [categoryLabel({ key: r.category_key, name: r.category_name }), r.notes, r.account_name, r.to_account_name]
        .join(' ').toLowerCase().includes(needle));

  const activeCount = [scope !== 'all', period !== 'all', accountId !== ALL, categoryId !== ALL].filter(Boolean).length;
  const clear = () => {
    setScope('all'); setPeriod('all'); setFromDay(''); setToDay(''); setAccountId(ALL); setCategoryId(ALL);
  };

  const groups: { key: string; items: TransactionListRow[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.occurred_at);
    if (groups.at(-1)?.key !== k) groups.push({ key: k, items: [] });
    groups.at(-1)!.items.push(r);
  }
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

  const remove = async (id: string) => {
    if (await confirm({ title: t('tx.deleteTitle'), body: t('tx.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteTransaction(db, id);
    }
  };
  const add = () => router.push('/add');

  const chip = (label: string, selected: boolean) => (
    <View style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: selected ? theme.primaryText : theme.text }} numberOfLines={1}>{label}</ThemedText>
    </View>
  );
  const allLabel = t('common.all');

  return (
    <Screen title={t('tx.title')} actions={<IconButton icon="plus" label={t('tx.add')} onPress={add} />}>
      {data.length === 0 ? (
        <EmptyState icon="list" title={t('tx.empty')} hint={t('tx.emptyHint')} action={<Button label={t('tx.add')} icon="plus" onPress={add} />} />
      ) : (
        <>
          <TextField label={t('common.search')} value={q} onChangeText={setQ} placeholder={t('common.search')} />
          <Segmented<Kind> value={kind} onChange={setKind}
            options={[{ value: 'all', label: allLabel }, { value: 'expense', label: t('tx.expense') }, { value: 'income', label: t('tx.income') }, { value: 'transfer', label: t('tx.transfer') }]} />
          <Button variant="ghost" icon="chevron-down" onPress={() => setShowFilters((v) => !v)}
            label={activeCount ? `${t('tx.filters')} (${activeCount})` : t('tx.filters')} />
          {showFilters && <>
            <Segmented<Period> label={t('tx.period')} value={period} onChange={setPeriod}
              options={[{ value: 'all', label: t('tx.allTime') }, { value: 'month', label: t('tx.thisMonth') }, { value: 'lastMonth', label: t('tx.lastMonth') }, { value: 'year', label: t('tx.thisYear') }, { value: 'custom', label: t('tx.custom') }]} />
            {period === 'custom' && <>
              <TextField label={t('tx.fromDate')} value={fromDay} onChangeText={setFromDay} placeholder="2026-11-01" inputMode="numeric"
                hint={t('tx.dateHint')} error={fromDay.trim() && !customRange ? t('tx.invalidRange') : undefined} />
              <TextField label={t('tx.toDate')} value={toDay} onChangeText={setToDay} placeholder="2026-11-30" inputMode="numeric" />
            </>}
            <Segmented label={t('tx.scope')} value={scope} onChange={setScope}
              options={[{ value: 'all', label: allLabel }, { value: 'personal', label: t('tx.personal') }, { value: 'work', label: t('tx.work') }]} />
            <ChoiceGrid label={t('tx.account')} choices={[ALL, ...accountNames.keys()]} value={accountId} onChange={setAccountId}
              labelOf={(id) => accountNames.get(id) ?? allLabel} render={(id, sel) => chip(accountNames.get(id) ?? allLabel, sel)} />
            {categoryNames.size > 0 && (
              <ChoiceGrid label={t('tx.category')} choices={[ALL, ...categoryNames.keys()]} value={categoryId} onChange={setCategoryId}
                labelOf={(id) => categoryNames.get(id) ?? allLabel} render={(id, sel) => chip(categoryNames.get(id) ?? allLabel, sel)} />
            )}
            {activeCount > 0 && <Button variant="secondary" icon="x" label={t('tx.clearFilters')} onPress={clear} />}
          </>}
          {groups.length === 0 ? <EmptyState icon="search" title={t('tx.noResults')} /> : null}
          {groups.map((g) => (
            <Card key={g.key} style={{ padding: 4, gap: 0 }}>
              <SectionTitle>{dayLabel(g.items[0].occurred_at)}</SectionTitle>
              {g.items.map((r) => <TransactionItem key={r.id} tx={r} onPress={() => remove(r.id)} />)}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.three, minHeight: 40, borderRadius: 20, justifyContent: 'center', maxWidth: 200 },
});
