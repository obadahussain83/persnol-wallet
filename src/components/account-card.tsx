import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  amount: { fontSize: 18, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
