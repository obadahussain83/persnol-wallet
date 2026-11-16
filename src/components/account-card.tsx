import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, IconBadge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import type { AccountBalance } from '@/db/queries';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

export function AccountCard({ account, onPress }: { account: AccountBalance; onPress?: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const archived = !!account.archived_at;
  return (
    <Card onPress={onPress} glow={account.color ?? theme.primary} style={archived ? { opacity: 0.6 } : undefined} testID={`account-${account.name}`}>
      <View style={styles.row}>
        <IconBadge icon={account.icon ?? 'wallet'} color={account.color ?? theme.primary} size={48} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>{account.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {account.currency}{archived ? ` · ${t('common.archived')}` : ''}
          </ThemedText>
        </View>
        <ThemedText
          type="smallBold"
          style={[styles.amount, { color: account.balance_minor < 0 ? theme.expense : theme.text }]}>
          {formatMoney(account.balance_minor, account.currency, i18n.language)}
        </ThemedText>
        {onPress ? <AppIcon name="chevron-right" size={18} color={theme.textSecondary} /> : null}
      </View>
      {account.goal_minor ? (
        <View style={styles.goal}>
          <ProgressBar ratio={account.balance_minor / account.goal_minor} color={account.color ?? theme.primary} height={6} />
          <ThemedText type="small" themeColor="textSecondary">
            {account.balance_minor >= account.goal_minor
              ? t('accounts.goalReached')
              : t('accounts.goalProgress', {
                pct: Math.max(0, Math.floor((account.balance_minor / account.goal_minor) * 100)),
                left: formatMoney(account.goal_minor - Math.max(0, account.balance_minor), account.currency, i18n.language),
              })}
            {account.goal_date ? ` · ${t('accounts.goalBy', { date: account.goal_date })}` : ''}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  goal: { gap: Spacing.one },
  amount: { fontSize: 18, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
