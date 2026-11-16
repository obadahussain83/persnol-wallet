// Small building blocks shared by every screen.
import { type ReactNode, useId } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from './app-icon';
import { PressableScale, Reveal } from './motion';

/** Document-unique id for SVG defs: tab screens stay mounted, so a fixed id would resolve to a hidden screen's gradient. */
export const useSvgId = () => useId().replace(/[^a-zA-Z0-9]/g, '');

export function Screen({ title, actions, children, scroll = true, narrow = false }: {
  title?: string; actions?: ReactNode; children: ReactNode; scroll?: boolean;
  /** Forms: a compact column instead of the full content width. */
  narrow?: boolean;
}) {
  const theme = useTheme();
  const glowId = useSvgId();
  const body = (
    <Reveal style={[styles.content, narrow && styles.narrow]}>
      {(title || actions) && (
        <View style={styles.header}>
          {title ? <ThemedText style={styles.title} accessibilityRole="header">{title}</ThemedText> : <View />}
          <View style={styles.row}>{actions}</View>
        </View>
      )}
      {children}
    </Reveal>
  );
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.background }]}>
      {/* Ambient light in the accent color, fixed behind the scrolling content: it ties every screen to the chosen color. */}
      <Svg style={styles.glow} width="100%" height={480} pointerEvents="none">
        <Defs>
          <RadialGradient id={glowId} cx="85%" cy="0%" r="75%">
            <Stop offset="0" stopColor={theme.primary} stopOpacity={theme.glow} />
            <Stop offset="1" stopColor={theme.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

type ButtonProps = {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string; loading?: boolean; disabled?: boolean; testID?: string;
};
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, testID }: ButtonProps) {
  const theme = useTheme();
  const bg = { primary: theme.primary, secondary: theme.backgroundSelected, danger: theme.danger, ghost: 'transparent' }[variant];
  const solid = variant === 'primary' || variant === 'danger';
  const fg = variant === 'primary' ? theme.primaryText : variant === 'danger' ? '#FFFFFF' : theme.text;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === 'primary' && { boxShadow: `0 14px 30px -14px ${theme.primary}, inset 0 1px 0 rgba(255,255,255,0.3)` },
        variant === 'secondary' && { borderWidth: 1, borderColor: theme.border },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? (
        // The icon sits in its own disc, so it reads as a part of the button rather than a glyph beside the label.
        <View style={[styles.buttonIcon, { backgroundColor: solid ? `${fg}26` : theme.backgroundSelected }]}>
          <AppIcon name={icon} size={16} color={fg} />
        </View>
      ) : null}
      <ThemedText style={[styles.buttonText, { color: fg }]}>{label}</ThemedText>
    </PressableScale>
  );
}

export function IconButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={[styles.iconButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <AppIcon name={icon} color={theme.text} />
    </PressableScale>
  );
}

export function TextField({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.shell, borderColor: error ? theme.danger : theme.border },
          props.editable === false && { opacity: 0.6 },
        ]}
      />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText>
        : hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
    </View>
  );
}

export function Card({ children, onPress, style, testID, glow }: {
  children: ReactNode; onPress?: () => void; style?: ViewStyle; testID?: string;
  /** Lights the card from its top corner in this color, so a card says what it is about before it is read. */
  glow?: string;
}) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border, boxShadow: theme.cardShadow }, glow && styles.clip, style];
  const content = glow ? <><CornerGlow color={glow} />{children}</> : children;
  if (!onPress) return <View style={base} testID={testID}>{content}</View>;
  return (
    <PressableScale testID={testID} accessibilityRole="button" onPress={onPress} style={base}>
      {content}
    </PressableScale>
  );
}

/** Decorative light from the top corner of its (clipping) parent. */
function CornerGlow({ color }: { color: string }) {
  const id = useSvgId();
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="100%" cy="0%" r="85%">
          <Stop offset="0" stopColor={color} stopOpacity={0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement, borderColor: theme.border, boxShadow: theme.cardShadow }]}><AppIcon name={icon} size={28} color={theme.primary} /></View>
      <ThemedText type="smallBold" style={styles.center}>{title}</ThemedText>
      {hint ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{hint}</ThemedText> : null}
      {action}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <View style={[styles.segmented, { backgroundColor: theme.shell, borderColor: theme.border }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
              style={[styles.segment, selected && { backgroundColor: theme.backgroundSelected, borderColor: theme.border, boxShadow: '0 6px 14px -8px rgba(0,0,0,0.45)' }]}>
              <ThemedText type="small" style={{ color: selected ? theme.text : theme.textSecondary }}>{o.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Wrapping grid of choices (chips, colors, icons). */
export function ChoiceGrid<T extends string>({ label, choices, value, onChange, render, labelOf }: {
  label: string; choices: T[]; value: T; onChange: (v: T) => void; render: (v: T, selected: boolean) => ReactNode; labelOf?: (v: T) => string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {choices.map((c) => (
          <Pressable key={c} accessibilityRole="radio" accessibilityLabel={labelOf ? labelOf(c) : c} accessibilityState={{ selected: c === value }} onPress={() => onChange(c)}>
            {render(c, c === value)}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function IconBadge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, borderColor: `${color}40` }]}>
      <AppIcon name={icon} color={color} size={size * 0.5} />
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  narrow: { maxWidth: 560 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { fontSize: 34, lineHeight: 46, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  button: { minHeight: 52, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  buttonText: { fontWeight: '600' },
  buttonIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  field: { gap: Spacing.two },
  input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, fontSize: 16, textAlign: 'auto' },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: 20, gap: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  segmented: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, padding: 4, flexWrap: 'wrap' },
  segment: { flexGrow: 1, minHeight: 40, paddingHorizontal: Spacing.two, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  clip: { overflow: 'hidden' },
  section: { marginTop: Spacing.two }, // no letter-spacing: it breaks Arabic joining
});
