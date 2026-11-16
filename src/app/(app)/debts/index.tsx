import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, EmptyState, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import type { DebtDirection } from '@/data/debts';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

type Row = { id: string; person: string; amount_minor: number; currency: string; note: string | null; settled_at: string | null };

export default function Debts() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const { data } = useQuery<Row>(
    `SELECT id, person, amount_minor, currency, note, settled_at FROM debts
     WHERE direction = ? ORDER BY settled_at IS NOT NULL, created_at DESC`,
    [direction],
  );
  const money = (minor: number, currency: string) => formatMoney(minor, currency, i18n.language);
  // Outstanding total per currency; currencies are never summed together.
  const totals: Record<string, number> = {};
  for (const d of data) if (!d.settled_at) totals[d.currency] = (totals[d.currency] ?? 0) + d.amount_minor;
  const color = direction === 'owed_to_me' ? theme.primary : theme.danger;

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
                    {row.note ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{row.note}</ThemedText> : null}
                  </View>
                  {row.settled_at ? <ThemedText type="small" themeColor="textSecondary">{t('debts.settled')}</ThemedText> : null}
                  <ThemedText type="smallBold" style={{ color }}>{money(row.amount_minor, row.currency)}</ThemedText>
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
