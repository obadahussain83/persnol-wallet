import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { type ChequeDirection, type ChequeStatus, daysUntil, DUE_SOON_DAYS } from '@/data/cheques';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

type Row = { id: string; person: string; amount_minor: number; currency: string; bank: string | null; number: string | null; due_date: string; status: ChequeStatus };

export default function Cheques() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [direction, setDirection] = useState<ChequeDirection>('incoming');
  const [show, setShow] = useState<'pending' | 'all'>('pending');
  const { data } = useQuery<Row>(
    `SELECT id, person, amount_minor, currency, bank, number, due_date, status FROM cheques
     WHERE direction = ? AND (? = 'all' OR status = 'pending')
     ORDER BY status <> 'pending', due_date`,
    [direction, show],
  );
  const money = (minor: number, currency: string) => formatMoney(minor, currency, i18n.language);
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  // Pending total per currency; currencies are never summed together.
  const totals: Record<string, number> = {};
  for (const c of data) if (c.status === 'pending') totals[c.currency] = (totals[c.currency] ?? 0) + c.amount_minor;
  const add = () => router.push({ pathname: '/cheques/[id]', params: { id: 'new', direction } });

  const dueLabel = (c: Row) => {
    if (c.status !== 'pending') return { text: t(`cheques.${c.status}`), color: c.status === 'bounced' ? theme.danger : theme.textSecondary };
    const d = daysUntil(c.due_date);
    if (d < 0) return { text: t('cheques.overdue', { count: -d }), color: theme.danger };
    if (d === 0) return { text: t('cheques.dueToday'), color: theme.warning };
    return { text: t('cheques.dueIn', { count: d }), color: d <= DUE_SOON_DAYS ? theme.warning : theme.textSecondary };
  };

  return (
    <Screen title={t('cheques.title')} actions={<IconButton icon="plus" label={t('cheques.new')} onPress={add} />}>
      <Segmented<ChequeDirection> value={direction} onChange={setDirection}
        options={[{ value: 'incoming', label: t('cheques.incoming') }, { value: 'outgoing', label: t('cheques.outgoing') }]} />
      <Segmented value={show} onChange={setShow}
        options={[{ value: 'pending', label: t('cheques.pendingOnly') }, { value: 'all', label: t('common.all') }]} />
      {data.length === 0 ? (
        <EmptyState icon="receipt" title={t('cheques.empty')} hint={t('cheques.emptyHint')}
          action={<Button label={t('cheques.new')} icon="plus" onPress={add} />} />
      ) : (
        <>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">{t('cheques.pendingTotal')}</ThemedText>
            <ThemedText type="smallBold" style={{ color: direction === 'incoming' ? theme.income : theme.expense }}>
              {Object.entries(totals).map(([c, m]) => money(m, c)).join(' · ') || '—'}
            </ThemedText>
          </Card>
          {data.map((c) => {
            const due = dueLabel(c);
            return (
              <Card key={c.id} onPress={() => router.push(`/cheques/${c.id}`)} style={{ opacity: c.status === 'pending' ? 1 : 0.6 }}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{c.person}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {[date.format(new Date(`${c.due_date}T12:00:00`)), c.bank, c.number && `#${c.number}`].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  <View style={styles.end}>
                    <ThemedText type="smallBold">{money(c.amount_minor, c.currency)}</ThemedText>
                    <ThemedText type="small" style={{ color: due.color }}>{due.text}</ThemedText>
                  </View>
                </View>
              </Card>
            );
          })}
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
