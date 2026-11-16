import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import type { MonthFlow } from '@/lib/reports';

/** Income vs expense per month: paired bars on one axis, legend above, month under each pair. */
export function TrendChart({ flow, currency, height = 140 }: { flow: MonthFlow[]; currency: string; height?: number }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const max = Math.max(1, ...flow.flatMap((m) => [m.income, m.expense]));
  // Empty months draw nothing; tiny non-zero values stay visible.
  const bar = (v: number) => (v > 0 ? Math.max(3, (v / max) * height) : 0);
  const month = new Intl.DateTimeFormat(i18n.language, { month: 'short' });
  const money = (m: number) => formatMoney(m, currency, i18n.language);
  return (
    <View style={styles.trend}>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: theme.income }]} /><ThemedText type="small">{t('tx.income')}</ThemedText>
        <View style={[styles.dot, { backgroundColor: theme.expense }]} /><ThemedText type="small">{t('tx.expense')}</ThemedText>
      </View>
      <View style={styles.chart} accessibilityRole="image"
        accessibilityLabel={flow.map((m) => `${month.format(m.start)}: ${t('tx.income')} ${money(m.income)}, ${t('tx.expense')} ${money(m.expense)}`).join('. ')}>
        {flow.map((m) => (
          <View key={m.start.toISOString()} style={styles.col}>
            <View style={[styles.bars, { height }]}>
              <View style={[styles.bar, { height: bar(m.income), backgroundColor: theme.income }]} />
              <View style={[styles.bar, { height: bar(m.expense), backgroundColor: theme.expense }]} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{month.format(m.start)}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export type Slice = { key: string; label: string; value: number; color: string };

/** Largest slices first; anything past `max` folds into one neutral "Other" slice (never an invented hue). */
export function topSlices(slices: readonly Slice[], max: number, otherLabel: string, otherColor: string): Slice[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max - 1).reduce((a, s) => a + s.value, 0);
  return [...sorted.slice(0, max - 1), { key: 'other', label: otherLabel, value: rest, color: otherColor }];
}

/**
 * Ring chart with the total in the middle and a legend (name, share, amount) beside it,
 * so identity never rests on color alone. Slices keep their category's own color.
 */
export function DonutChart({ slices, currency, title, size = 132 }: { slices: Slice[]; currency: string; title: string; size?: number }) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const total = slices.reduce((a, s) => a + s.value, 0);
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0; // 2px surface gap between segments
  const money = (m: number) => formatMoney(m, currency, i18n.language);
  // Each segment starts where the previous ones end; c/4 moves the start from 3 o'clock to 12 (no SVG transform: web warns on it).
  const lens = slices.map((s) => (s.value / total) * c);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, l) => a + l, 0));
  return (
    <View style={styles.donutRow} accessibilityRole="image"
      accessibilityLabel={`${title}: ${slices.map((s) => `${s.label} ${money(s.value)}`).join(', ')}`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundSelected} strokeWidth={stroke} fill="none" />
            {slices.map((s, i) => (
              <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${Math.max(0.5, lens[i] - gap)} ${c - Math.max(0.5, lens[i] - gap)}`} strokeDashoffset={c / 4 - starts[i]} />
            ))}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ThemedText type="small" themeColor="textSecondary">{title}</ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit style={styles.centerValue}>{money(total)}</ThemedText>
        </View>
      </View>
      <View style={styles.legendList}>
        {slices.map((s) => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <ThemedText type="small" numberOfLines={1} style={styles.shrink}>{s.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{Math.round((s.value / total) * 100)}% · {money(s.value)}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  trend: { gap: Spacing.two },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  col: { flex: 1, alignItems: 'center', gap: Spacing.one },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  centerValue: { fontSize: 16 },
  legendList: { flex: 1, gap: Spacing.two },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
