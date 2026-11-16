import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Card, IconBadge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { type Mode, setProfileMode } from '@/data/profile';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/session/session-provider';

/** Asked once after signup. Both choices can be changed later in Settings; nothing is deleted either way. */
export function ModeChooser() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { db, userId } = useUser();
  const [saving, setSaving] = useState<Mode | null>(null);
  const choose = async (mode: Mode) => {
    setSaving(mode);
    try {
      await setProfileMode(db, userId, mode);
    } finally {
      setSaving(null);
    }
  };
  const options: { mode: Mode; icon: string }[] = [{ mode: 'personal', icon: 'wallet' }, { mode: 'business', icon: 'briefcase' }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four }]}>
      <View style={styles.inner}>
        <ThemedText type="title">{t('mode.question')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('mode.hint')}</ThemedText>
        {options.map((o) => (
          <Card key={o.mode} onPress={() => choose(o.mode)} testID={`mode-${o.mode}`} glow={saving === o.mode ? theme.primary : undefined}>
            <View style={styles.row}>
              <IconBadge icon={o.icon} color={theme.primary} size={48} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{t(`mode.${o.mode}`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t(`mode.${o.mode}Hint`)}</ThemedText>
              </View>
            </View>
          </Card>
        ))}
        <ThemedText type="small" themeColor="textSecondary">{t('mode.later')}</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.four },
  inner: { width: '100%', maxWidth: 520, gap: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: Spacing.one },
});
