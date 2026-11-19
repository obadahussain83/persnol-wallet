import type { ChangeEvent, CSSProperties } from 'react';
import { useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { DateFieldProps } from './date-field.types';

/** Uses the browser's native calendar popover on web. */
export function DateField({ label, value, onChange, onBlur, error }: DateFieldProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 52,
    boxSizing: 'border-box',
    border: `1px solid ${error ? theme.danger : theme.border}`,
    borderRadius: Radius.md,
    paddingInline: Spacing.three,
    fontSize: 16,
    color: theme.text,
    background: theme.shell,
    colorScheme: colorScheme === 'dark' ? 'dark' : 'light',
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <input
        aria-label={label}
        aria-invalid={!!error}
        type="date"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        style={inputStyle}
      />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}
