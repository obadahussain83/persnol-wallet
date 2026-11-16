import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SyncStatus } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { AppIcon } from '@/components/ui/app-icon';
import { Button, Card, ChoiceGrid, Screen, SectionTitle, Segmented } from '@/components/ui/primitives';
import { type Accent, Accents } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import { profileInputSchema, updateProfile } from '@/data/profile';
import { useTheme } from '@/hooks/use-theme';
import type { Language } from '@/i18n';
import { type ThemePref, usePreferences } from '@/preferences/preferences-provider';
import { useSession, useUser } from '@/session/session-provider';

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const prefs = usePreferences();
  const { db, userId, email, localOnly } = useUser();
  const { signOut, pendingUploads } = useSession();
  const { data: profile } = useQuery<{ display_name: string | null; primary_currency: string }>(
    'SELECT display_name, primary_currency FROM profiles WHERE id = ?', [userId]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const form = useForm({ resolver: zodResolver(profileInputSchema), defaultValues: { displayName: '', primaryCurrency: 'ILS' as (typeof CURRENCIES)[number] } });
  const loaded = useRef(false);
  useEffect(() => {
    if (!profile[0] || loaded.current) return;
    loaded.current = true;
    form.reset({ displayName: profile[0].display_name ?? '', primaryCurrency: profile[0].primary_currency as (typeof CURRENCIES)[number] });
  }, [profile, form]);

  const save = form.handleSubmit(async (v) => {
    try {
      await updateProfile(db, userId, v);
      setMessage({ text: t('settings.saved'), ok: true });
    } catch (e) {
      setMessage({ text: errorMessage(e), ok: false });
    }
  });

  const changeLanguage = async (l: Language) => {
    if (prefs.setLanguage(l)) await confirm({ title: t('settings.restartForRtl'), confirmLabel: 'OK', cancelLabel: null });
  };

  const doSignOut = async () => {
    const count = await pendingUploads();
    if (count > 0 && !(await confirm({ title: t('settings.pendingTitle'), body: t('settings.pendingBody', { count }), confirmLabel: t('settings.signOut'), destructive: true }))) return;
    await signOut();
  };

  return (
    <Screen title={t('settings.title')} narrow>
      <SectionTitle>{t('settings.profile')}</SectionTitle>
      <Card>
        <FormTextField control={form.control} name="displayName" label={t('settings.displayName')} maxLength={100} />
        <Controller control={form.control} name="primaryCurrency" render={({ field }) => (
          <Segmented label={t('settings.primaryCurrency')} value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        )} />
        {message ? <ThemedText type="small" style={{ color: message.ok ? theme.income : theme.danger }} accessibilityLiveRegion="polite">{message.text}</ThemedText> : null}
        <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} />
      </Card>

      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <Card>
        <Segmented<Language> label={t('settings.language')} value={prefs.language} onChange={changeLanguage}
          options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        <Segmented<ThemePref> label={t('settings.theme')} value={prefs.theme} onChange={prefs.setTheme}
          options={[{ value: 'system', label: t('settings.system') }, { value: 'light', label: t('settings.light') }, { value: 'dark', label: t('settings.dark') }]} />
        <ChoiceGrid<Accent> label={t('settings.accent')} choices={Object.keys(Accents) as Accent[]} value={prefs.accent} onChange={prefs.setAccent}
          labelOf={(a) => t(`settings.accents.${a}`)}
          render={(a, selected) => (
            <View testID={`accent-${a}`} style={[styles.swatch, { backgroundColor: Accents[a][prefs.scheme], borderColor: selected ? theme.text : 'transparent' }]}>
              {selected ? <AppIcon name="check" size={20} color={theme.primaryText} /> : null}
            </View>
          )} />
      </Card>

      <SectionTitle>{t('settings.account')}</SectionTitle>
      <Card>
        <SyncStatus />
        {localOnly ? (
          <>
            <ThemedText type="smallBold">{t('settings.localOnly')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{t('settings.localOnlyHint')}</ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('settings.signedInAs', { email })}</ThemedText>
            <Button variant="secondary" icon="log-out" label={t('settings.signOut')} onPress={doSignOut} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 44pt keeps the swatch a comfortable touch target.
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
