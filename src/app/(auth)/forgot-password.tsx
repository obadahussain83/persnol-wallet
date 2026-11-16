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
import { emailOnlySchema } from '@/lib/auth-schemas';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } });

  const submit = handleSubmit(async ({ email }) => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') });
    // Same message whether or not the account exists, so emails can't be probed.
    setMessage(error ? { text: errorMessage(error), tone: 'error' } : { text: t('auth.resetSent'), tone: 'info' });
  });

  return (
    <AuthLayout title={t('auth.forgotPassword')} message={message}>
      <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" onSubmitEditing={() => submit()} />
      <Button label={t('auth.sendResetLink')} onPress={submit} loading={formState.isSubmitting} />
      <Link href="/sign-in"><ThemedText type="linkPrimary">{t('auth.haveAccount')}</ThemedText></Link>
    </AuthLayout>
  );
}
