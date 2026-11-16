import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button, Card, EmptyState, IconBadge, IconButton, Screen } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { deleteRecurring, nextOccurrence, type RecurringRow, setRecurringPaused } from '@/data/recurring';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { parseDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useUser } from '@/session/session-provider';

type Row = RecurringRow & {
  account_name: string; category_key: string | null; category_name: string | null; category_icon: string | null; category_color: string | null;
};

export default function Recurring() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db } = useUser();
  const { data } = useQuery<Row>(
    `SELECT r.*, a.name AS account_name, c.key AS category_key, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
     FROM recurring r JOIN accounts a ON a.id = r.account_id JOIN categories c ON c.id = r.category_id
     ORDER BY r.paused_at IS NOT NULL, r.created_at DESC`,
  );
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
  const add = () => router.push('/add');

  const remove = async (id: string) => {
    if (await confirm({ title: t('recurring.deleteTitle'), body: t('recurring.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteRecurring(db, id);
    }
  };

  return (
    <Screen title={t('recurring.title')} actions={<IconButton icon="plus" label={t('tx.add')} onPress={add} />}>
      {data.length === 0 ? (
        <EmptyState icon="repeat" title={t('recurring.empty')} hint={t('recurring.emptyHint')}
          action={<Button label={t('tx.add')} icon="plus" onPress={add} />} />
      ) : data.map((r) => {
        const start = parseDay(r.start_date);
        const color = r.type === 'income' ? theme.income : theme.expense;
        return (
          <Card key={r.id} style={{ opacity: r.paused_at ? 0.6 : 1 }}>
            <View style={styles.row}>
              <IconBadge icon={r.category_icon ?? 'tag'} color={r.category_color ?? theme.primary} />
              <View style={styles.flex}>
                <ThemedText numberOfLines={1}>{r.note || categoryLabel({ key: r.category_key, name: r.category_name })}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {t(`recurring.${r.frequency}`)} · {r.account_name}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color }}>
                {r.type === 'income' ? '+' : '−'}{formatMoney(r.amount_minor, r.currency, i18n.language)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {r.paused_at ? t('recurring.paused') : start ? t('recurring.next', { date: date.format(nextOccurrence(start, r.frequency)) }) : ''}
            </ThemedText>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button variant="secondary" icon={r.paused_at ? 'refresh-cw' : 'pause'}
                  label={r.paused_at ? t('recurring.resume') : t('recurring.pause')} onPress={() => setRecurringPaused(db, r.id, !r.paused_at)} />
              </View>
              <View style={styles.flex}>
                <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={() => remove(r.id)} />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
