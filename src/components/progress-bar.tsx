import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Horizontal fill bar; `ratio` is clamped to 0..1. Follows the layout direction, so it fills from the right in Arabic. */
export function ProgressBar({ ratio, color, height = 8 }: { ratio: number; color: string; height?: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', flexDirection: 'row' },
});
