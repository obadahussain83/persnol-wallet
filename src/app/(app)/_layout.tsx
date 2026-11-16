import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, type TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { SyncStatus } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { PressableScale } from '@/components/ui/motion';
import { DesktopBreakpoint, Radius, Spacing } from '@/constants/theme';
import { ModeChooser } from '@/components/mode-chooser';
import { useFxRefresh } from '@/hooks/use-fx-refresh';
import { useMode } from '@/hooks/use-mode';
import { useRecurringGenerator } from '@/hooks/use-recurring-generator';
import { useTheme } from '@/hooks/use-theme';

type Href = '/' | '/transactions' | '/add' | '/accounts' | '/debts' | '/categories' | '/settings' | '/more' | '/budgets' | '/reports' | '/recurring' | '/cheques' | '/contacts' | '/invoices';
// business: hidden in personal mode (the route still exists; only the entry point is hidden).
type NavItem = { name: string; href: Href; icon: string; label: string; mobileLabel?: string; desktop: boolean; mobile: boolean; primary?: boolean; activeFor?: string[]; business?: boolean };

const NAV: Record<string, NavItem> = {
  add: { name: 'add', href: '/add', icon: 'plus', label: 'tx.add', mobileLabel: 'nav.add', desktop: true, mobile: true, primary: true },
  index: { name: 'index', href: '/', icon: 'layout-dashboard', label: 'nav.dashboard', mobileLabel: 'nav.home', desktop: true, mobile: true },
  transactions: { name: 'transactions', href: '/transactions', icon: 'list', label: 'nav.transactions', desktop: true, mobile: true },
  accounts: { name: 'accounts', href: '/accounts', icon: 'wallet', label: 'nav.accounts', desktop: true, mobile: true },
  categories: { name: 'categories', href: '/categories', icon: 'tags', label: 'nav.categories', desktop: true, mobile: false },
  settings: { name: 'settings', href: '/settings', icon: 'settings', label: 'nav.settings', desktop: true, mobile: false },
  reports: { name: 'reports', href: '/reports', icon: 'chart-column', label: 'nav.reports', desktop: true, mobile: false },
  budgets: { name: 'budgets', href: '/budgets', icon: 'target', label: 'nav.budgets', desktop: true, mobile: false },
  recurring: { name: 'recurring', href: '/recurring', icon: 'repeat', label: 'nav.recurring', desktop: true, mobile: false },
  invoices: { name: 'invoices', href: '/invoices', icon: 'receipt', label: 'nav.invoices', desktop: true, mobile: false, business: true },
  contacts: { name: 'contacts', href: '/contacts', icon: 'user', label: 'nav.contacts', desktop: true, mobile: false, business: true },
  cheques: { name: 'cheques', href: '/cheques', icon: 'receipt', label: 'nav.cheques', desktop: true, mobile: false },
  debts: { name: 'debts', href: '/debts', icon: 'coins', label: 'nav.debts', desktop: true, mobile: false },
  more: { name: 'more', href: '/more', icon: 'ellipsis', label: 'nav.more', desktop: false, mobile: true, activeFor: ['/reports', '/budgets', '/recurring', '/cheques', '/contacts', '/invoices', '/debts', '/categories', '/settings'] },
};
// Every route is registered in both layouts; each layout orders them and hides the ones it doesn't use.
const DESKTOP_ORDER = ['add', 'index', 'transactions', 'accounts', 'reports', 'budgets', 'recurring', 'cheques', 'contacts', 'invoices', 'debts', 'categories', 'settings', 'more'];
const MOBILE_ORDER = ['index', 'transactions', 'add', 'accounts', 'more', 'reports', 'budgets', 'recurring', 'cheques', 'contacts', 'invoices', 'debts', 'categories', 'settings'];

export default function AppLayout() {
  const wide = useWindowDimensions().width >= DesktopBreakpoint;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  useRecurringGenerator();
  useFxRefresh();
  const { mode, loaded, isBusiness } = useMode();

  const triggers = (wide ? DESKTOP_ORDER : MOBILE_ORDER).map((key) => {
    const item = NAV[key];
    return (
      <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
        <NavButton item={item} wide={wide} hidden={(wide ? !item.desktop : !item.mobile) || (!!item.business && !isBusiness)} />
      </TabTrigger>
    );
  });

  // Asked once, after the profile has synced down: personal only, or personal + business.
  if (loaded && mode === null) return <ModeChooser />;

  return (
    <Tabs style={[styles.flex, { flexDirection: wide ? 'row' : 'column', backgroundColor: theme.background }]}>
      {wide && (
        <TabList style={[styles.sidebar, { backgroundColor: theme.background, borderColor: theme.border, paddingTop: insets.top + Spacing.four }]}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: theme.primary, boxShadow: `0 10px 24px -10px ${theme.primary}` }]}><AppIcon name="wallet" size={18} color={theme.primaryText} /></View>
            <ThemedText type="smallBold" style={styles.brandText}>{t('app.name')}</ThemedText>
          </View>
          {triggers}
          <View style={styles.flex} />
          <SyncStatus />
        </TabList>
      )}
      <TabSlot style={styles.flex} />
      {!wide && (
        <TabList style={[styles.bottomBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border, boxShadow: theme.cardShadow, marginBottom: Math.max(insets.bottom, Spacing.two) }]}>
          {triggers}
        </TabList>
      )}
    </Tabs>
  );
}

function NavButton({ item, wide, hidden, isFocused, onPress }: TabTriggerSlotProps & { item: NavItem; wide: boolean; hidden: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pathname = usePathname();
  if (hidden) return null;
  const active = isFocused || !!item.activeFor?.some((p) => pathname.startsWith(p));
  const label = t(!wide && item.mobileLabel ? item.mobileLabel : item.label);

  if (item.primary) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={t('tx.add')}
        style={[
          wide ? styles.sideAdd : styles.tabAdd,
          { backgroundColor: theme.primary, boxShadow: `0 14px 30px -10px ${theme.primary}, inset 0 1px 0 rgba(255,255,255,0.3)` },
          !wide && { borderColor: theme.background },
        ]}>
        <AppIcon name="plus" size={wide ? 20 : 28} color={theme.primaryText} />
        {wide ? <ThemedText type="smallBold" style={{ color: theme.primaryText }}>{label}</ThemedText> : null}
      </PressableScale>
    );
  }

  const color = active ? theme.primary : theme.textSecondary;
  if (!wide) {
    // Phone tab: the active one is marked by a tinted capsule behind its icon, not by color alone.
    return (
      <PressableScale onPress={onPress} accessibilityRole="link" accessibilityState={{ selected: active }} accessibilityLabel={label} style={styles.tabItem}>
        <View style={[styles.tabPill, active && { backgroundColor: `${theme.primary}2E`, boxShadow: `0 8px 20px -10px ${theme.primary}` }]}>
          <AppIcon name={item.icon} size={22} color={color} />
        </View>
        <ThemedText style={[styles.tabLabel, { color: active ? theme.text : theme.textSecondary }]} numberOfLines={1}>{label}</ThemedText>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.sideItem, active && { backgroundColor: theme.backgroundElement, borderColor: theme.border, boxShadow: theme.cardShadow }]}>
      <AppIcon name={item.icon} size={20} color={color} />
      <ThemedText type="small" style={{ color: active ? theme.text : theme.textSecondary }}>{label}</ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sidebar: { width: 264, flexDirection: 'column', alignItems: 'stretch', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, borderEndWidth: StyleSheet.hairlineWidth },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three, paddingHorizontal: Spacing.two },
  logo: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 16 },
  sideAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, minHeight: 52, borderRadius: Radius.pill, marginBottom: Spacing.four },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 48, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1, borderColor: 'transparent' },
  // A floating island rather than a bar glued to the screen edge.
  bottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderRadius: 32, marginHorizontal: Spacing.three, marginTop: Spacing.two, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  tabItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56, justifyContent: 'center' },
  tabPill: { width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  // Raised out of the bar; the ring in the page color makes it read as docked into a notch.
  tabAdd: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.one, marginTop: -30 },
});
