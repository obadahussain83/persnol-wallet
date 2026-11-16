import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, Screen } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Mobile overflow menu. Budgets, reports and goals join here in later phases.
const ITEMS: { href: Href; icon: string; label: string }[] = [
  { href: '/debts', icon: 'coins', label: 'nav.debts' },
  { href: '/categories', icon: 'tags', label: 'nav.categories' },
  { href: '/settings', icon: 'settings', label: 'nav.settings' },
];

export default function More() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen title={t('more.title')}>
      {ITEMS.map((i) => (
        <Card key={i.label} onPress={() => router.push(i.href)}>
          <View style={styles.row}>
            <AppIcon name={i.icon} color={theme.primary} />
            <ThemedText style={styles.flex}>{t(i.label)}</ThemedText>
            <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
