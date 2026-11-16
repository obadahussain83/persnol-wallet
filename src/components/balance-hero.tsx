import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { useCountUp } from '@/components/ui/motion';
import { useSvgId } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';

const SHELL_RADIUS = 36;
const SHELL_PAD = 6;

/**
 * The dashboard's lead surface: total balance in a currency, with this month's money in and out.
 * Same material as every other card (dark plate in a tinted tray); the accent only lights it from a corner.
 */
export function BalanceHero({ currency, totalMinor, incomeMinor, expenseMinor, testID }: {
  currency: string; totalMinor: number; incomeMinor: number; expenseMinor: number; testID?: string;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const glowId = useSvgId();
  const shown = useCountUp(totalMinor);
  const money = (minor: number) => formatMoney(minor, currency, i18n.language);
  const flow = incomeMinor + expenseMinor;
  // Web ignores adjustsFontSizeToFit, so phones get a smaller size outright instead of a clipped number.
  const compact = useWindowDimensions().width < 480;

  return (
    <View testID={testID} style={[styles.shell, { backgroundColor: theme.shell, borderColor: theme.border, boxShadow: `0 40px 80px -48px ${theme.primary}` }]}>
      <View style={[styles.core, compact && styles.coreCompact, { backgroundColor: theme.backgroundElement, borderColor: theme.border, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }]}>
        {/* Decoration only: accent light from the top corner and coin-like rings. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <RadialGradient id={glowId} cx="100%" cy="0%" r="90%">
              <Stop offset="0" stopColor={theme.primary} stopOpacity={0.42} />
              <Stop offset="1" stopColor={theme.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
          {[80, 140, 200, 260].map((r) => <Circle key={r} cx="6%" cy="108%" r={r} stroke={theme.primary} strokeOpacity={0.16} strokeWidth={1} fill="none" />)}
        </Svg>

        <View style={[styles.tag, { backgroundColor: theme.shell, borderColor: theme.border }]}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <ThemedText type="small" themeColor="textSecondary">{t('dashboard.balances')} · {currency}</ThemedText>
        </View>
        <ThemedText style={[styles.total, compact && styles.totalCompact, { color: totalMinor < 0 ? theme.expense : theme.text }]} numberOfLines={1} adjustsFontSizeToFit
          accessibilityLabel={money(totalMinor)}>
          {money(shown)}
        </ThemedText>

        <View style={styles.month}>
          <ThemedText type="small" themeColor="textSecondary">{t('dashboard.thisMonth')}</ThemedText>
          {/* Share of this month's movement that was income; empty when nothing moved. */}
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            {flow > 0 ? <View style={[styles.fill, { backgroundColor: theme.primary, width: `${(incomeMinor / flow) * 100}%` }]} /> : null}
          </View>
          <View style={styles.stats}>
            <Flow icon="arrow-down-left" label={t('dashboard.income')} value={money(incomeMinor)} color={theme.income} />
            <Flow icon="arrow-up-right" label={t('dashboard.expenses')} value={money(expenseMinor)} color={theme.expense} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Flow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.flow}>
      <View style={[styles.flowIcon, { backgroundColor: `${color}22` }]}><AppIcon name={icon} size={18} color={color} /></View>
      <View style={styles.flowText}>
        <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
        <ThemedText style={styles.flowValue} numberOfLines={1} adjustsFontSizeToFit>{value}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: SHELL_RADIUS, borderWidth: 1, padding: SHELL_PAD, flexGrow: 1, flexBasis: 320, minWidth: 0 },
  // Inner radius = outer radius − padding, so the two curves stay concentric.
  core: { borderRadius: SHELL_RADIUS - SHELL_PAD, borderWidth: 1, padding: Spacing.five, gap: Spacing.two, overflow: 'hidden', flexGrow: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  coreCompact: { padding: Spacing.four },
  totalCompact: { fontSize: 38, lineHeight: 54 },
  total: { fontSize: 56, lineHeight: 76, fontWeight: '700', fontVariant: ['tabular-nums'] },
  month: { marginTop: Spacing.four, gap: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  stats: { flexDirection: 'row', gap: Spacing.three },
  flow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flowText: { flex: 1, minWidth: 0 },
  flowValue: { fontSize: 18, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
