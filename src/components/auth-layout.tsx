import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/preferences/preferences-provider';

export function AuthLayout({ title, children, message }: { title: string; children: ReactNode; message?: { text: string; tone: 'error' | 'info' } | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { language, setLanguage } = usePreferences();
  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}><AppIcon name="wallet" size={28} color={theme.primaryText} /></View>
          <ThemedText style={styles.appName}>{t('app.name')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('auth.tagline')}</ThemedText>
        </View>
        <Card style={styles.card}>
          <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">{title}</ThemedText>
          {message ? (
            <ThemedText type="small" accessibilityLiveRegion="polite" style={{ color: message.tone === 'error' ? theme.danger : theme.income }}>
              {message.text}
            </ThemedText>
          ) : null}
          {children}
        </Card>
        <Segmented
          options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]}
          value={language}
          onChange={setLanguage}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: Spacing.four, paddingTop: Spacing.five },
  brand: { alignItems: 'center', gap: Spacing.one },
  logo: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  appName: { fontSize: 24, fontWeight: '700' },
  card: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 18 },
});
