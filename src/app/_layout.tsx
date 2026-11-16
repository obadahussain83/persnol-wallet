import { PowerSyncContext } from '@powersync/react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import '@/i18n';
import { useTranslation } from 'react-i18next';

import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { Button, EmptyState, Screen } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/use-theme';
import { PreferencesProvider, usePreferences } from '@/preferences/preferences-provider';
import { SessionProvider, useSession } from '@/session/session-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <Themed />
    </PreferencesProvider>
  );
}

function Themed() {
  const { scheme } = usePreferences();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = useTheme();
  const navTheme = { ...base, colors: { ...base.colors, background: c.background, card: c.backgroundElement, text: c.text, border: c.border, primary: c.primary } };
  return (
    <ThemeProvider value={navTheme}>
      <ConfirmProvider>
        <SessionProvider>
          <Routes />
        </SessionProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}

function Routes() {
  const { session, db, ready, dbError, retryDb } = useSession();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  if (dbError) return <DatabaseError onRetry={retryDb} />;

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="reset-password" />
    </Stack>
  );
  return db ? <PowerSyncContext.Provider value={db}>{stack}</PowerSyncContext.Provider> : stack;
}

function DatabaseError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState icon="cloud-off" title={t('errors.dbOpenTitle')} hint={t('errors.dbOpenHint')}
        action={<Button label={t('common.retry')} icon="refresh-cw" onPress={onRetry} />} />
    </Screen>
  );
}
