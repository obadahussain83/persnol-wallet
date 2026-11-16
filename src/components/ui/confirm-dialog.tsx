// Cross-platform confirmation dialog. (React Native's Alert does nothing on web.)
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import i18n from '@/i18n';

import { Button } from './primitives';

type Options = { title: string; body?: string; confirmLabel?: string; destructive?: boolean; cancelLabel?: string | null };
type Confirm = (o: Options) => Promise<boolean>;
const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);

  const confirm = useCallback<Confirm>((o) => {
    setOpts(o);
    return new Promise((resolve) => (resolver.current = resolve));
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal transparent visible={!!opts} animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel={i18n.t('common.cancel')}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement }]} accessibilityRole="alert" onPress={() => {}}>
            <ThemedText type="smallBold" style={styles.title}>{opts?.title}</ThemedText>
            {opts?.body ? <ThemedText type="small" themeColor="textSecondary">{opts.body}</ThemedText> : null}
            <View style={styles.actions}>
              {opts?.cancelLabel !== null && (
                <Button variant="secondary" label={opts?.cancelLabel ?? i18n.t('common.cancel')} onPress={() => close(false)} />
              )}
              <Button variant={opts?.destructive ? 'danger' : 'primary'} label={opts?.confirmLabel ?? i18n.t('common.confirm')} onPress={() => close(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm outside ConfirmProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  sheet: { width: '100%', maxWidth: 420, borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, flexWrap: 'wrap' },
});
