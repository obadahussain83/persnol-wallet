import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthLayout } from '@/components/auth-layout';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button } from '@/components/ui/primitives';
import { newPasswordSchema } from '@/lib/auth-schemas';
import { supabase } from '@/lib/supabase';

// Opened from the reset email (?code=… via PKCE). Lives outside both route guards.
export default function ResetPassword() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' } });

  useEffect(() => {
    if (!supabase || !code) return setState('invalid');
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => setState(error ? 'invalid' : 'ready'));
  }, [code]);

  const submit = handleSubmit(async ({ password }) => {
    setError(null);
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) return setError(errorMessage(error));
    setState('done');
    setTimeout(() => router.replace('/'), 1200);
  });

  const message =
    state === 'invalid' ? { text: t('auth.invalidLink'), tone: 'error' as const }
    : state === 'done' ? { text: t('auth.passwordUpdated'), tone: 'info' as const }
    : error ? { text: error, tone: 'error' as const } : null;

  return (
    <AuthLayout title={t('auth.setNewPassword')} message={message}>
      {state === 'ready' && (
        <>
          <FormTextField control={control} name="password" label={t('auth.newPassword')} secureTextEntry autoComplete="new-password" />
          <FormTextField control={control} name="confirm" label={t('auth.confirmPassword')} secureTextEntry autoComplete="new-password" onSubmitEditing={() => submit()} />
          <Button label={t('common.save')} onPress={submit} loading={formState.isSubmitting} />
        </>
      )}
      {state === 'invalid' && <Button variant="secondary" label={t('auth.signIn')} onPress={() => router.replace('/')} />}
    </AuthLayout>
  );
}
