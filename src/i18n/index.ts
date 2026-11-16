import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { ar } from './ar';
import { en } from './en';

export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const isRtlLanguage = (lang: Language) => lang === 'ar';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: 'ar', // Arabic-first app; the saved preference overrides this at startup
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
});

/** Display name for a category: translated for built-ins, as typed for user-created ones. */
export function categoryLabel(c: { key: string | null; name: string | null }): string {
  return c.key ? i18n.t(`categories.defaults.${c.key}`, { defaultValue: c.name ?? '' }) : (c.name ?? '');
}

export default i18n;
