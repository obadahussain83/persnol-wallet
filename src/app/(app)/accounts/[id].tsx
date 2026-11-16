import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ACCOUNT_ICONS, AppIcon, SWATCHES } from '@/components/ui/app-icon';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button, ChoiceGrid, EmptyState, Screen, Segmented } from '@/components/ui/primitives';
import { Radius } from '@/constants/theme';
import {
  ACCOUNT_TYPES, accountHasTransactions, accountInputSchema, CURRENCIES, createAccount, deleteAccount, setAccountArchived, updateAccount,
} from '@/data/accounts';
import type { AccountRow } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<AccountRow & { id: string }>('SELECT * FROM accounts WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);
  const row = rows[0];
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const form = useForm({
    resolver: zodResolver(accountInputSchema),
    defaultValues: { name: '', type: 'cash' as const, currency: 'ILS' as const, openingBalance: '0', description: '', color: SWATCHES[0], icon: 'wallet' },
  });

  // Fill the form once per loaded record (live query updates after our own save must not reset it).
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (isNew && profile[0] && !loaded.current) {
      loaded.current = 'new';
      form.setValue('currency', profile[0].primary_currency as (typeof CURRENCIES)[number]);
    }
    if (!row || loaded.current === row.id) return;
    loaded.current = row.id;
    const currency = (row.currency ?? 'ILS') as (typeof CURRENCIES)[number];
    form.reset({
      name: row.name ?? '', type: (row.type ?? 'cash') as (typeof ACCOUNT_TYPES)[number], currency,
      openingBalance: toDecimalString(row.opening_balance_minor ?? 0, currency), description: row.description ?? '',
      color: row.color ?? SWATCHES[0], icon: row.icon ?? 'wallet',
    });
    accountHasTransactions(db, row.id).then(setLocked);
  }, [row, profile, isNew, db, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('accounts.edit')}><EmptyState icon="wallet" title={t('errors.notFound')} /></Screen>;
  }

  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      if (isNew) await createAccount(db, userId, v);
      else await updateAccount(db, id, v);
      goBack('/accounts');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const archive = async () => {
    if (row?.archived_at) return setAccountArchived(db, id, false);
    if (await confirm({ title: t('accounts.archiveTitle'), body: t('accounts.archiveBody'), confirmLabel: t('common.archive') })) {
      await setAccountArchived(db, id, true);
      goBack('/accounts');
    }
  };

  const remove = async () => {
    const body = (await accountHasTransactions(db, id)) ? t('accounts.deleteBodyWithTx') : t('categories.deleteBody');
    if (await confirm({ title: t('accounts.deleteTitle'), body, confirmLabel: t('common.delete'), destructive: true })) {
      try {
        await deleteAccount(db, id);
        goBack('/accounts');
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  };

  const { control } = form;
  return (
    <Screen title={isNew ? t('accounts.new') : t('accounts.edit')} narrow>
      <FormTextField control={control} name="name" label={t('accounts.name')} autoFocus={isNew} maxLength={100} />
      <Controller control={control} name="currency" render={({ field }) => (
        <View pointerEvents={locked ? 'none' : 'auto'} style={locked ? { opacity: 0.5 } : undefined}>
          <Segmented label={t('accounts.currency')} value={field.value} onChange={field.onChange}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          {locked ? <ThemedText type="small" themeColor="textSecondary">{t('accounts.currencyLockedHint')}</ThemedText> : null}
        </View>
      )} />
      <FormTextField control={control} name="openingBalance" label={t('accounts.openingBalance')} keyboardType="decimal-pad" inputMode="decimal" />
      <Button variant="ghost" icon="chevron-down" label={showMore ? t('common.fewerOptions') : t('common.moreOptions')} onPress={() => setShowMore((v) => !v)} />
      {showMore && <>
      <FormTextField control={control} name="description" label={`${t('accounts.description')} (${t('common.optional')})`} multiline maxLength={500} />
      <Controller control={control} name="color" render={({ field }) => (
        <ChoiceGrid label={t('accounts.color')} choices={SWATCHES} value={field.value} onChange={field.onChange}
          render={(c, sel) => <View style={[styles.swatch, { backgroundColor: c, borderColor: sel ? theme.text : 'transparent' }]} />} />
      )} />
      <Controller control={control} name="icon" render={({ field }) => (
        <ChoiceGrid label={t('accounts.icon')} choices={ACCOUNT_ICONS} value={field.value} onChange={field.onChange}
          render={(i, sel) => (
            <View style={[styles.iconChoice, { backgroundColor: sel ? theme.primary : theme.backgroundSelected }]}>
              <AppIcon name={i} color={sel ? theme.primaryText : theme.text} />
            </View>
          )} />
      )} />
      </>}
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && (
        <Button variant="secondary" icon={row?.archived_at ? 'archive-restore' : 'archive'}
          label={row?.archived_at ? t('common.restore') : t('common.archive')} onPress={archive} />
      )}
      {!isNew && <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  iconChoice: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
