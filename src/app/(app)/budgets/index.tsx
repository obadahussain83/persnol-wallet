import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, IconBadge, IconButton, Screen } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { BUDGET_PROGRESS_SQL, type BudgetProgress } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { monthRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** Spent at or above this share of the limit turns the bar amber. */
const WARN_AT = 0.8;

export default function Budgets() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const range = useMemo(() => monthRange(), []);
  const { data } = useQuery<BudgetProgress>(BUDGET_PROGRESS_SQL, range);
  const money = (minor: number, currency: string) => formatMoney(minor, currency, i18n.language);
  const add = () => router.push({ pathname: '/budgets/[id]', params: { id: 'new' } });
  const month = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <Screen title={t('budgets.title')} actions={<IconButton icon="plus" label={t('budgets.new')} onPress={add} />}>
      {data.length === 0 ? (
        <EmptyState icon="target" title={t('budgets.empty')} hint={t('budgets.emptyHint')}
          action={<Button label={t('budgets.new')} icon="plus" onPress={add} />} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">{month}</ThemedText>
          {data.map((b) => {
            const ratio = b.spent_minor / b.amount_minor;
            const left = b.amount_minor - b.spent_minor;
            const color = ratio >= 1 ? theme.danger : ratio >= WARN_AT ? theme.warning : theme.primary;
            return (
              <Card key={b.id} onPress={() => router.push(`/budgets/${b.id}`)}>
                <View style={styles.row}>
                  <IconBadge icon={b.category_icon ?? 'tag'} color={b.category_color ?? theme.primary} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{categoryLabel({ key: b.category_key, name: b.category_name })}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {money(b.spent_minor, b.currency)} / {money(b.amount_minor, b.currency)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color }}>{Math.round(ratio * 100)}%</ThemedText>
                </View>
                <ProgressBar ratio={ratio} color={color} />
                <ThemedText type="small" style={{ color: left < 0 ? theme.danger : theme.textSecondary }}>
                  {left < 0 ? t('budgets.over', { amount: money(-left, b.currency) }) : t('budgets.left', { amount: money(left, b.currency) })}
                </ThemedText>
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
});
