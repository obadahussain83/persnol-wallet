import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ContactPicker } from '@/components/contact-picker';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormDateField, FormTextField } from '@/components/ui/form';
import { Button, Card, EmptyState, Screen, SectionTitle, Segmented, TextField } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import {
  addDebtPayment, createDebt, type DebtDirection, debtInputSchema, deleteDebt, deleteDebtPayment, setDebtSettled, updateDebt, whatsappUrl,
} from '@/data/debts';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Currency = (typeof CURRENCIES)[number];
type Row = {
  id: string; direction: DebtDirection; person: string; amount_minor: number; currency: Currency; note: string | null;
  settled_at: string | null; due_date: string | null; phone: string | null; contact_id: string | null;
};
type Payment = { id: string; amount_minor: number; paid_at: string };

export default function DebtForm() {
  // contactId/person/phone are prefilled when the debt is started from a contact's page.
  const { id, direction: directionParam, contactId: contactParam, person: personParam, phone: phoneParam } =
    useLocalSearchParams<{ id: string; direction?: DebtDirection; contactId?: string; person?: string; phone?: string }>();
  const isNew = id === 'new';
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM debts WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);
  const { data: payments } = useQuery<Payment>('SELECT id, amount_minor, paid_at FROM debt_payments WHERE debt_id = ? ORDER BY paid_at DESC', [id]);
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(debtInputSchema),
    defaultValues: { direction: (directionParam === 'i_owe' ? 'i_owe' : 'owed_to_me') as DebtDirection, person: personParam ?? '', amount: '', currency: 'ILS' as Currency, note: '', dueDate: '',
      phone: phoneParam ?? '', contactId: contactParam ?? '' },
  });

  // Fill the form once per loaded record (live query updates after our own save must not reset it).
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (isNew && profile[0] && !loaded.current) {
      loaded.current = 'new';
      form.setValue('currency', profile[0].primary_currency as Currency);
    }
    if (!row || loaded.current === row.id) return;
    loaded.current = row.id;
    form.reset({ direction: row.direction, person: row.person, amount: toDecimalString(row.amount_minor, row.currency), currency: row.currency, note: row.note ?? '', dueDate: row.due_date ?? '', phone: row.phone ?? '', contactId: row.contact_id ?? '' });
  }, [row, profile, isNew, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('debts.edit')}><EmptyState icon="coins" title={t('errors.notFound')} /></Screen>;
  }

  // Started from a contact's page: return there (back() from a one-screen tab would land on the first tab).
  const done = () => (contactParam ? router.navigate(`/contacts/${contactParam}`) : goBack('/debts'));
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = form.handleSubmit((v) => run(() => (isNew ? createDebt(db, userId, v).then(() => undefined) : updateDebt(db, id, v))));
  const settle = () => run(() => setDebtSettled(db, id, !row?.settled_at));
  const remove = async () => {
    if (await confirm({ title: t('debts.deleteTitle'), body: t('categories.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await run(() => deleteDebt(db, id));
    }
  };

  const money = (minor: number) => formatMoney(minor, row?.currency ?? 'ILS', i18n.language);
  const paid = payments.reduce((a, p) => a + p.amount_minor, 0);
  const remaining = (row?.amount_minor ?? 0) - paid;
  const pay = async () => {
    setPayError(null);
    try {
      await addDebtPayment(db, userId, id, payAmount, new Date().toISOString());
      setPayAmount('');
    } catch (e) {
      setPayError(errorMessage(e));
    }
  };
  const remind = () => {
    if (!row) return;
    const date = row.due_date ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(new Date(`${row.due_date}T12:00:00`)) : null;
    const text = t(date ? 'debts.reminderTextDue' : 'debts.reminderText', { person: row.person, amount: money(remaining), date });
    Linking.openURL(whatsappUrl(row.phone, text));
  };
  const day = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  const { control } = form;
  return (
    <Screen title={isNew ? t('debts.new') : t('debts.edit')} narrow>
      <Controller control={control} name="direction" render={({ field }) => (
        <Segmented value={field.value} onChange={field.onChange}
          options={[{ value: 'owed_to_me', label: t('debts.owedToMe') }, { value: 'i_owe', label: t('debts.iOwe') }]} />
      )} />
      <Controller control={control} name="contactId" render={({ field }) => (
        <ContactPicker value={field.value ?? ''} onChange={(c) => {
          field.onChange(c?.id ?? '');
          if (c) { form.setValue('person', c.name); if (c.phone) form.setValue('phone', c.phone); }
        }} />
      )} />
      <FormTextField control={control} name="person" label={t('debts.person')} autoFocus={isNew} maxLength={100} />
      <Controller control={control} name="currency" render={({ field }) => (
        <Segmented label={t('accounts.currency')} value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      )} />
      <FormTextField control={control} name="amount" label={t('tx.amount')} keyboardType="decimal-pad" inputMode="decimal" />
      <FormDateField control={control} name="dueDate" label={`${t('debts.dueDate')} (${t('common.optional')})`} />
      <FormTextField control={control} name="phone" label={`${t('debts.phone')} (${t('common.optional')})`} placeholder="+970 59 123 4567" inputMode="tel" maxLength={30} />
      <FormTextField control={control} name="note" label={`${t('tx.note')} (${t('common.optional')})`} multiline maxLength={500} />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && row && (
        <>
          <SectionTitle>{t('debts.payments')}</SectionTitle>
          <Card>
            <View style={styles.between}>
              <ThemedText type="small" themeColor="textSecondary">{t('debts.paidOf', { paid: money(paid), total: money(row.amount_minor) })}</ThemedText>
              <ThemedText type="smallBold">{t('debts.remaining', { amount: money(remaining) })}</ThemedText>
            </View>
            <ProgressBar ratio={row.amount_minor ? paid / row.amount_minor : 0} color={theme.primary} />
            {payments.map((p) => (
              <View key={p.id} style={styles.between}>
                <ThemedText type="small" themeColor="textSecondary">{day.format(new Date(p.paid_at))}</ThemedText>
                <View style={styles.inline}>
                  <ThemedText type="smallBold">{money(p.amount_minor)}</ThemedText>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10} onPress={() => deleteDebtPayment(db, p.id)}>
                    <AppIcon name="x" size={16} color={theme.textSecondary} />
                  </Pressable>
                </View>
              </View>
            ))}
            {remaining > 0 && (
              <View style={styles.inline}>
                <View style={styles.flex}>
                  <TextField label={t('debts.paymentAmount')} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" inputMode="decimal"
                    error={payError ?? undefined} />
                </View>
                <Button variant="secondary" icon="plus" label={t('debts.addPayment')} onPress={pay} disabled={!payAmount.trim()} />
              </View>
            )}
          </Card>
          {row.direction === 'owed_to_me' && !row.settled_at && (
            <Button variant="secondary" icon="message-circle" label={t('debts.remind')} onPress={remind} />
          )}
        </>
      )}
      {!isNew && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button variant="secondary" icon={row?.settled_at ? 'refresh-cw' : 'check'}
              label={row?.settled_at ? t('debts.reopen') : t('debts.markSettled')} onPress={settle} />
          </View>
          <View style={styles.flex}>
            <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
});
