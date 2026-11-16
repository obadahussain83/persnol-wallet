import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthLayout } from '@/components/auth-layout';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button } from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { signUpSchema } from '@/lib/auth-schemas';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setMessage(null);
    const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: Linking.createURL('/') } });
    if (error) setMessage({ text: errorMessage(error), tone: 'error' });
    else if (!data.session) setMessage({ text: t('auth.checkEmail'), tone: 'info' }); // email confirmation enabled
  });

  return (
    <AuthLayout title={t('auth.signUp')} message={message}>
      <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" />
      <FormTextField control={control} name="password" label={t('auth.password')} secureTextEntry autoComplete="new-password" />
      <FormTextField control={control} name="confirm" label={t('auth.confirmPassword')} secureTextEntry autoComplete="new-password" onSubmitEditing={() => submit()} />
      <Button label={t('auth.signUp')} onPress={submit} loading={formState.isSubmitting} />
      <Link href="/sign-in"><ThemedText type="linkPrimary">{t('auth.haveAccount')}</ThemedText></Link>
    </AuthLayout>
  );
}
