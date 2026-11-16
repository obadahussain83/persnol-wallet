import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { IconBadge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import type { TransactionListRow } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { usePreferences } from '@/preferences/preferences-provider';

export function TransactionItem({ tx, onPress }: { tx: TransactionListRow; onPress?: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { isRTL } = usePreferences();
  const transfer = tx.type === 'transfer';
  const arrow = isRTL ? '←' : '→';

  const title = transfer ? t('tx.transfer') : categoryLabel({ key: tx.category_key, name: tx.category_name });
  const where = transfer ? `${tx.account_name} ${arrow} ${tx.to_account_name ?? ''}` : tx.account_name;
  const parts = [tx.scope === 'work' ? t('tx.work') : null, where, tx.notes].filter(Boolean);
  const subtitle = parts.join(' · ');
  const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
  const color = tx.type === 'expense' ? theme.expense : tx.type === 'income' ? theme.income : theme.text;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sign}${formatMoney(tx.amount_minor, tx.currency, i18n.language)}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <IconBadge icon={transfer ? 'arrow-left-right' : (tx.category_icon ?? 'tag')} color={transfer ? theme.primary : (tx.category_color ?? theme.primary)} size={44} />
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{subtitle}</ThemedText>
      </View>
      {/* The amount sits in a chip of its own color, so income and spending separate at a glance down the list. */}
      <View style={[styles.chip, { backgroundColor: `${color}1A` }]}>
        <ThemedText type="smallBold" style={[styles.amount, { color }]}>
          {sign}{formatMoney(tx.amount_minor, tx.currency, i18n.language)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 20 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
});
