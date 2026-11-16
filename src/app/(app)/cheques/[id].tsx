import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ContactPicker } from '@/components/contact-picker';
import { ThemedText } from '@/components/themed-text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button, EmptyState, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import {
  type ChequeDirection, chequeInputSchema, type ChequeStatus, createCheque, deleteCheque, setChequeStatus, updateCheque,
} from '@/data/cheques';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Currency = (typeof CURRENCIES)[number];
type Row = {
  id: string; direction: ChequeDirection; person: string; amount_minor: number; currency: Currency; bank: string | null;
  number: string | null; due_date: string; status: ChequeStatus; note: string | null; contact_id: string | null;
};

export default function ChequeForm() {
  const { id, direction: directionParam, contactId: contactParam, person: personParam } =
    useLocalSearchParams<{ id: string; direction?: ChequeDirection; contactId?: string; person?: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM cheques WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(chequeInputSchema),
    defaultValues: {
      direction: (directionParam === 'outgoing' ? 'outgoing' : 'incoming') as ChequeDirection, person: personParam ?? '', amount: '',
      currency: 'ILS' as Currency, bank: '', number: '', dueDate: dayKey(new Date().toISOString()), note: '',
      contactId: contactParam ?? '',
    },
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
    form.reset({
      direction: row.direction, person: row.person, amount: toDecimalString(row.amount_minor, row.currency), currency: row.currency,
      bank: row.bank ?? '', number: row.number ?? '', dueDate: row.due_date, note: row.note ?? '', contactId: row.contact_id ?? '',
    });
  }, [row, profile, isNew, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('cheques.edit')}><EmptyState icon="receipt" title={t('errors.notFound')} /></Screen>;
  }

  // Started from a contact's page: return there (back() from a one-screen tab would land on the first tab).
  const done = () => (contactParam ? router.navigate(`/contacts/${contactParam}`) : goBack('/cheques'));
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const save = form.handleSubmit((v) => run(() => (isNew ? createCheque(db, userId, v) : updateCheque(db, id, v))));

  // Clearing moves real money, so offer to record it as a transaction (prefilled; the user picks account and category).
  const clear = async () => {
    if (!row) return;
    await setChequeStatus(db, id, 'cleared');
    if (await confirm({ title: t('cheques.recordTitle'), body: t('cheques.recordBody'), confirmLabel: t('cheques.record') })) {
      const label = [t('cheques.cheque'), row.number && `#${row.number}`, row.person].filter(Boolean).join(' ');
      router.replace({
        pathname: '/add',
        params: { type: row.direction === 'incoming' ? 'income' : 'expense', amount: toDecimalString(row.amount_minor, row.currency), note: label },
      });
    } else {
      done();
    }
  };
  const setStatus = (s: ChequeStatus) => run(() => setChequeStatus(db, id, s));
  const remove = async () => {
    if (await confirm({ title: t('cheques.deleteTitle'), body: t('categories.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await run(() => deleteCheque(db, id));
    }
  };

  const { control } = form;
  return (
    <Screen title={isNew ? t('cheques.new') : t('cheques.edit')} narrow>
      <Controller control={control} name="direction" render={({ field }) => (
        <Segmented value={field.value} onChange={field.onChange}
          options={[{ value: 'incoming', label: t('cheques.incoming') }, { value: 'outgoing', label: t('cheques.outgoing') }]} />
      )} />
      <Controller control={control} name="contactId" render={({ field }) => (
        <ContactPicker value={field.value ?? ''} onChange={(c) => { field.onChange(c?.id ?? ''); if (c) form.setValue('person', c.name); }} />
      )} />
      <FormTextField control={control} name="person" label={t('cheques.person')} autoFocus={isNew} maxLength={100} />
      <Controller control={control} name="currency" render={({ field }) => (
        <Segmented label={t('accounts.currency')} value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      )} />
      <FormTextField control={control} name="amount" label={t('tx.amount')} keyboardType="decimal-pad" inputMode="decimal" />
      <FormTextField control={control} name="dueDate" label={t('cheques.dueDate')} placeholder="2026-12-01" inputMode="numeric" />
      <FormTextField control={control} name="bank" label={`${t('cheques.bank')} (${t('common.optional')})`} maxLength={100} />
      <FormTextField control={control} name="number" label={`${t('cheques.number')} (${t('common.optional')})`} maxLength={50} inputMode="numeric" />
      <FormTextField control={control} name="note" label={`${t('tx.note')} (${t('common.optional')})`} multiline maxLength={500} />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && row?.status === 'pending' && (
        <View style={styles.row}>
          <View style={styles.flex}><Button variant="secondary" icon="check" label={t('cheques.markCleared')} onPress={clear} /></View>
          <View style={styles.flex}><Button variant="secondary" icon="x" label={t('cheques.markBounced')} onPress={() => setStatus('bounced')} /></View>
        </View>
      )}
      {!isNew && row && row.status !== 'pending' && (
        <Button variant="secondary" icon="refresh-cw" label={t('cheques.markPending')} onPress={() => setStatus('pending')} />
      )}
      {!isNew && <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
