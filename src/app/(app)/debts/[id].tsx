import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button, EmptyState, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import { createDebt, type DebtDirection, debtInputSchema, deleteDebt, setDebtSettled, updateDebt } from '@/data/debts';
import { useTheme } from '@/hooks/use-theme';
import { toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Currency = (typeof CURRENCIES)[number];
type Row = { id: string; direction: DebtDirection; person: string; amount_minor: number; currency: Currency; note: string | null; settled_at: string | null };

export default function DebtForm() {
  const { id, direction: directionParam } = useLocalSearchParams<{ id: string; direction?: DebtDirection }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM debts WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(debtInputSchema),
    defaultValues: { direction: (directionParam === 'i_owe' ? 'i_owe' : 'owed_to_me') as DebtDirection, person: '', amount: '', currency: 'ILS' as Currency, note: '' },
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
    form.reset({ direction: row.direction, person: row.person, amount: toDecimalString(row.amount_minor, row.currency), currency: row.currency, note: row.note ?? '' });
  }, [row, profile, isNew, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('debts.edit')}><EmptyState icon="coins" title={t('errors.notFound')} /></Screen>;
  }

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      goBack('/debts');
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

  const { control } = form;
  return (
    <Screen title={isNew ? t('debts.new') : t('debts.edit')} narrow>
      <Controller control={control} name="direction" render={({ field }) => (
        <Segmented value={field.value} onChange={field.onChange}
          options={[{ value: 'owed_to_me', label: t('debts.owedToMe') }, { value: 'i_owe', label: t('debts.iOwe') }]} />
      )} />
      <FormTextField control={control} name="person" label={t('debts.person')} autoFocus={isNew} maxLength={100} />
      <Controller control={control} name="currency" render={({ field }) => (
        <Segmented label={t('accounts.currency')} value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      )} />
      <FormTextField control={control} name="amount" label={t('tx.amount')} keyboardType="decimal-pad" inputMode="decimal" />
      <FormTextField control={control} name="note" label={`${t('tx.note')} (${t('common.optional')})`} multiline maxLength={500} />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button variant="secondary" icon={row?.settled_at ? 'refresh-cw' : 'check'}
              label={row?.settled_at ? t('debts.reopen') : t('debts.markSettled')} onPress={settle} />
          </View>
          <View style={styles.flex}>
            <Button variant="ghost" icon="trash" label={t('common.delete')} onPress={remove} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
