import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, parseDay } from '@/lib/dates';

import { AppIcon } from './app-icon';
import type { DateFieldProps } from './date-field.types';

/** A calendar-backed YYYY-MM-DD field for iOS and Android. */
export function DateField({ label, value, onChange, onBlur, error, clearLabel }: DateFieldProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = parseDay(value) ?? new Date();

  const close = () => {
    setShowPicker(false);
    onBlur?.();
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={[styles.input, { backgroundColor: theme.shell, borderColor: error ? theme.danger : theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: showPicker }}
          onPress={() => setShowPicker(true)}
          style={styles.valueButton}>
          <ThemedText style={{ color: value ? theme.text : theme.textSecondary }}>
            {value || 'YYYY-MM-DD'}
          </ThemedText>
          <AppIcon name="calendar-days" size={20} color={theme.textSecondary} />
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            hitSlop={8}
            onPress={() => { onChange(''); onBlur?.(); }}>
            <AppIcon name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="inline"
          presentation="dialog"
          accentColor={theme.primary}
          themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
          onValueChange={(_event, date) => {
            onChange(dayKey(date.toISOString()));
            close();
          }}
          onDismiss={close}
        />
      ) : null}
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  valueButton: {
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
