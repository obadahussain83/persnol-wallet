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
import { Button, ChoiceGrid, EmptyState, IconBadge, Screen, Segmented } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import { budgetInputSchema, createBudget, deleteBudget, updateBudget } from '@/data/budgets';
import { orderCategoryTree } from '@/data/categories';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Currency = (typeof CURRENCIES)[number];
type Row = { id: string; category_id: string; amount_minor: number; currency: Currency };
type Cat = { id: string; key: string | null; name: string | null; icon: string | null; color: string | null; parent_id: string | null };

export default function BudgetForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM budgets WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ primary_currency: string }>('SELECT primary_currency FROM profiles WHERE id = ?', [userId]);
  const { data: cats } = useQuery<Cat>(
    `SELECT id, key, name, icon, color, parent_id FROM categories WHERE kind = 'expense' AND archived_at IS NULL`,
  );
  const categories = orderCategoryTree(cats, categoryLabel).map((x) => x.row);
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(budgetInputSchema),
    defaultValues: { categoryId: '', amount: '', currency: 'ILS' as Currency },
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
    form.reset({ categoryId: row.category_id, amount: toDecimalString(row.amount_minor, row.currency), currency: row.currency });
  }, [row, profile, isNew, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('budgets.edit')}><EmptyState icon="target" title={t('errors.notFound')} /></Screen>;
  }

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      goBack('/budgets');
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const save = form.handleSubmit((v) => run(() => (isNew ? createBudget(db, userId, v) : updateBudget(db, id, v))));
  const remove = async () => {
    if (await confirm({ title: t('budgets.deleteTitle'), body: t('categories.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await run(() => deleteBudget(db, id));
    }
  };

  const { control } = form;
  return (
    <Screen title={isNew ? t('budgets.new') : t('budgets.edit')} narrow>
      <Controller control={control} name="categoryId" render={({ field, fieldState }) => (
        <View style={styles.field}>
          <ChoiceGrid
            label={t('tx.category')}
            choices={categories.map((c) => c.id)}
            value={field.value}
            onChange={field.onChange}
            labelOf={(cid) => categoryLabel(categories.find((c) => c.id === cid)!)}
            render={(cid, sel) => {
              const c = categories.find((x) => x.id === cid)!;
              return (
                <View style={[styles.tile, sel && { backgroundColor: theme.backgroundSelected, borderColor: theme.primary }]}>
                  <IconBadge icon={c.icon ?? 'tag'} color={c.color ?? theme.primary} size={40} />
                  <ThemedText type="small" numberOfLines={1} style={styles.tileText}>{categoryLabel(c)}</ThemedText>
                </View>
              );
            }}
          />
          {fieldState.error?.message ? (
            <ThemedText type="small" style={{ color: theme.danger }}>{t(`errors.${fieldState.error.message}`)}</ThemedText>
          ) : null}
        </View>
      )} />
      <Controller control={control} name="currency" render={({ field }) => (
        <Segmented label={t('accounts.currency')} value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      )} />
      <FormTextField control={control} name="amount" label={t('budgets.monthlyLimit')} keyboardType="decimal-pad" inputMode="decimal" />
      <ThemedText type="small" themeColor="textSecondary">{t('budgets.hint')}</ThemedText>
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  tile: { width: 80, alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: 2, borderColor: 'transparent' },
  tileText: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
});
