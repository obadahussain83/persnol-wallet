import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, EmptyState, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { daysUntil } from '@/data/cheques';
import type { DebtDirection } from '@/data/debts';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

type Row = {
  id: string; person: string; amount_minor: number; paid_minor: number; currency: string; note: string | null;
  settled_at: string | null; due_date: string | null;
};

export default function Debts() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const { data } = useQuery<Row>(
    `SELECT d.id, d.person, d.amount_minor, d.currency, d.note, d.settled_at, d.due_date,
       COALESCE((SELECT SUM(p.amount_minor) FROM debt_payments p WHERE p.debt_id = d.id), 0) AS paid_minor
     FROM debts d WHERE d.direction = ? ORDER BY d.settled_at IS NOT NULL, d.due_date IS NULL, d.due_date, d.created_at DESC`,
    [direction],
  );
  const money = (minor: number, currency: string) => formatMoney(minor, currency, i18n.language);
  // Outstanding total per currency; currencies are never summed together.
  const totals: Record<string, number> = {};
  for (const d of data) if (!d.settled_at) totals[d.currency] = (totals[d.currency] ?? 0) + d.amount_minor - d.paid_minor;
  const color = direction === 'owed_to_me' ? theme.primary : theme.danger;
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  const overdue = (r: Row) => !r.settled_at && !!r.due_date && daysUntil(r.due_date) < 0;
  // Due date, partial-payment progress and note, whichever apply.
  const subtitle = (r: Row) => [
    r.due_date && !r.settled_at ? t('debts.dueOn', { date: date.format(new Date(`${r.due_date}T12:00:00`)) }) : null,
    r.paid_minor > 0 && !r.settled_at ? t('debts.paidSoFar', { amount: money(r.paid_minor, r.currency) }) : null,
    r.note,
  ].filter(Boolean).join(' · ');

  return (
    <Screen
      title={t('debts.title')}
      actions={<IconButton icon="plus" label={t('debts.new')} onPress={() => router.push({ pathname: '/debts/[id]', params: { id: 'new', direction } })} />}>
      <Segmented options={[{ value: 'owed_to_me', label: t('debts.owedToMe') }, { value: 'i_owe', label: t('debts.iOwe') }]} value={direction} onChange={setDirection} />
      {data.length === 0 ? (
        <EmptyState icon="coins" title={t('debts.empty')} hint={t('debts.emptyHint')} />
      ) : (
        <>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">{t('debts.outstanding')}</ThemedText>
            <ThemedText type="smallBold" style={{ color }}>
              {Object.entries(totals).map(([c, m]) => money(m, c)).join(' · ') || '—'}
            </ThemedText>
          </Card>
          <Card style={styles.list}>
            {data.map((row) => (
              <Card key={row.id} onPress={() => router.push(`/debts/${row.id}`)}
                style={{ ...styles.item, opacity: row.settled_at ? 0.55 : 1, borderColor: 'transparent', boxShadow: 'none' }}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{row.person}</ThemedText>
                    {subtitle(row) ? <ThemedText type="small" style={{ color: overdue(row) ? theme.danger : theme.textSecondary }} numberOfLines={1}>{subtitle(row)}</ThemedText> : null}
                  </View>
                  {row.settled_at ? <ThemedText type="small" themeColor="textSecondary">{t('debts.settled')}</ThemedText> : null}
                  <ThemedText type="smallBold" style={{ color }}>{money(row.settled_at ? row.amount_minor : row.amount_minor - row.paid_minor, row.currency)}</ThemedText>
                  <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />
                </View>
              </Card>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.one, gap: 0 },
  item: { paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
