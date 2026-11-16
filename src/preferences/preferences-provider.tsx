import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { I18nManager, Platform, useColorScheme } from 'react-native';

import { type Accent, Accents } from '@/constants/theme';
import i18n,{ isRtlLanguage, type Language } from '@/i18n';

// Device-level preferences (needed before sign-in). Per-user settings live in `profiles`.
export type ThemePref = 'system' | 'light' | 'dark';
type Prefs = { language: Language; theme: ThemePref; accent: Accent };
type Ctx = Prefs & {
  scheme: 'light' | 'dark';
  isRTL: boolean;
  /** Returns true when a native restart is needed to flip layout direction. */
  setLanguage: (l: Language) => boolean;
  setTheme: (t: ThemePref) => void;
  setAccent: (a: Accent) => void;
};

const KEY = 'preferences';
const PreferencesContext = createContext<Ctx | null>(null);

function applyDirection(lang: Language): boolean {
  const rtl = isRtlLanguage(lang);
  if (Platform.OS === 'web') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl); // native applies this on next app start
  return true;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as Partial<Prefs>) : {}))
      .catch(() => ({}) as Partial<Prefs>)
      .then((saved) => {
        // Stored accent is checked against the list so a removed color falls back instead of crashing.
        const accent = saved.accent && saved.accent in Accents ? saved.accent : 'teal';
        const p: Prefs = { language: saved.language ?? 'ar', theme: saved.theme ?? 'system', accent };
        i18n.changeLanguage(p.language);
        applyDirection(p.language);
        setPrefs(p);
      });
  }, []);

  if (!prefs) return null; // splash stays up until preferences load

  const save = (next: Prefs) => {
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch((e) => console.warn('Saving preferences failed', e));
  };

  const value: Ctx = {
    ...prefs,
    scheme: prefs.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.theme,
    isRTL: isRtlLanguage(prefs.language),
    setLanguage: (language) => {
      i18n.changeLanguage(language);
      save({ ...prefs, language });
      return applyDirection(language);
    },
    setTheme: (theme) => save({ ...prefs, theme }),
    setAccent: (accent) => save({ ...prefs, accent }),
  };
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences outside PreferencesProvider');
  return ctx;
}
