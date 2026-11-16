import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { daysUntil } from '@/data/cheques';
import type { InvoiceKind, InvoiceStatus } from '@/data/invoices';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

type Row = { id: string; number: string; client_name: string; currency: string; total_minor: number; status: InvoiceStatus; issue_date: string; due_date: string | null };

export default function Invoices() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [kind, setKind] = useState<InvoiceKind>('invoice');
  const { data } = useQuery<Row>(
    `SELECT id, number, client_name, currency, total_minor, status, issue_date, due_date FROM invoices
     WHERE kind = ? ORDER BY status IN ('paid', 'cancelled'), issue_date DESC, number DESC`,
    [kind],
  );
  const add = () => router.push({ pathname: '/invoices/[id]', params: { id: 'new', kind } });
  // Unpaid invoice total per currency (drafts excluded: not sent yet).
  const unpaid: Record<string, number> = {};
  if (kind === 'invoice') for (const r of data) if (r.status === 'sent') unpaid[r.currency] = (unpaid[r.currency] ?? 0) + r.total_minor;
  const statusColor = (r: Row) => r.status === 'paid' ? theme.income
    : r.status === 'cancelled' ? theme.textSecondary
      : r.status === 'sent' && r.due_date && daysUntil(r.due_date) < 0 ? theme.danger : theme.warning;

  return (
    <Screen title={t('invoices.title')} actions={<IconButton icon="plus" label={t(kind === 'invoice' ? 'invoices.new' : 'invoices.newQuote')} onPress={add} />}>
      <Segmented<InvoiceKind> value={kind} onChange={setKind}
        options={[{ value: 'invoice', label: t('invoices.invoices') }, { value: 'quote', label: t('invoices.quotes') }]} />
      {data.length === 0 ? (
        <EmptyState icon="receipt" title={t('invoices.empty')} hint={t('invoices.emptyHint')}
          action={<Button label={t(kind === 'invoice' ? 'invoices.new' : 'invoices.newQuote')} icon="plus" onPress={add} />} />
      ) : (
        <>
          {kind === 'invoice' && Object.keys(unpaid).length > 0 && (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">{t('invoices.unpaid')}</ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.warning }}>
                {Object.entries(unpaid).map(([c, m]) => formatMoney(m, c, i18n.language)).join(' · ')}
              </ThemedText>
            </Card>
          )}
          {data.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/invoices/${r.id}`)} style={{ opacity: r.status === 'cancelled' ? 0.55 : 1 }}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>{r.client_name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{r.number} · {r.issue_date}</ThemedText>
                </View>
                <View style={styles.end}>
                  <ThemedText type="smallBold">{formatMoney(r.total_minor, r.currency, i18n.language)}</ThemedText>
                  <ThemedText type="small" style={{ color: statusColor(r) }}>{t(`invoices.status.${r.status}`)}</ThemedText>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end', gap: 2 },
});
