import { useQuery, useStatus } from '@powersync/react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

export function SyncStatus() {
  const { t } = useTranslation();
  const theme = useTheme();
  const status = useStatus();
  const { session } = useSession();
  const { data } = useQuery<{ n: number }>('SELECT COUNT(*) AS n FROM ps_crud');
  const pending = data[0]?.n ?? 0;

  const [icon, label, color] = session?.localOnly
    ? ['cloud-off', t('sync.localOnly'), theme.textSecondary]
    : !status.connected
      ? ['cloud-off', t('sync.offline'), theme.warning]
      : status.dataFlowStatus.uploading || status.dataFlowStatus.downloading
        ? ['refresh-cw', t('sync.syncing'), theme.primary]
        : status.hasSynced
          ? ['cloud', t('sync.synced'), theme.income]
          : ['refresh-cw', t('sync.connecting'), theme.textSecondary];

  const text = pending > 0 && !session?.localOnly ? `${label} · ${t('sync.pending', { count: pending })}` : label;
  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="text" accessibilityLabel={text} testID="sync-status">
      <AppIcon name={icon} size={14} color={color} />
      <ThemedText type="small" themeColor="textSecondary">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.lg, alignSelf: 'flex-start' },
});
