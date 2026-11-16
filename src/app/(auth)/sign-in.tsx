import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthLayout } from '@/components/auth-layout';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { signInSchema } from '@/lib/auth-schemas';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  // On success the session changes and the router guard moves to the app.
  const submit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await supabase!.auth.signInWithPassword(v);
    if (error) setError(errorMessage(error));
  });

  return (
    <AuthLayout title={t('auth.signIn')} message={error ? { text: error, tone: 'error' } : null}>
      <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <FormTextField control={control} name="password" label={t('auth.password')} secureTextEntry autoComplete="current-password" onSubmitEditing={() => submit()} />
      <Button label={t('auth.signIn')} onPress={submit} loading={formState.isSubmitting} />
      <Link href="/forgot-password"><ThemedText type="linkPrimary">{t('auth.forgotPassword')}</ThemedText></Link>
      <Link href="/sign-up"><ThemedText type="linkPrimary">{t('auth.noAccount')}</ThemedText></Link>
    </AuthLayout>
  );
}
