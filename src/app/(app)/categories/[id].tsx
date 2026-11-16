import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, CATEGORY_ICONS, SWATCHES } from '@/components/ui/app-icon';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button, ChoiceGrid, EmptyState, Screen, Segmented } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/theme';
import {
  categoryInputSchema, type CategoryKind, createCategory, deleteCategory, setCategoryArchived, updateCategory,
} from '@/data/categories';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Row = { id: string; key: string | null; name: string | null; kind: CategoryKind; parent_id: string | null; color: string | null; icon: string | null; archived_at: string | null };
const NONE = 'none';

export default function CategoryForm() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: CategoryKind }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM categories WHERE id = ?', [id]);
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const form = useForm({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: { name: '', kind: (kindParam === 'income' ? 'income' : 'expense') as CategoryKind, parentId: null as string | null, color: SWATCHES[0], icon: 'tag' },
  });
  const kind = form.watch('kind');
  const { data: parents } = useQuery<Row>(
    'SELECT * FROM categories WHERE kind = ? AND parent_id IS NULL AND archived_at IS NULL AND id != ?',
    [kind, id],
  );

  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!row || loaded.current === row.id) return;
    loaded.current = row.id;
    form.reset({ name: categoryLabel(row), kind: row.kind, parentId: row.parent_id, color: row.color ?? SWATCHES[0], icon: row.icon ?? 'tag' });
  }, [row, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('categories.edit')}><EmptyState icon="tags" title={t('errors.notFound')} /></Screen>;
  }

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = form.handleSubmit((v) =>
    run(async () => {
      if (isNew) await createCategory(db, userId, v);
      // An unchanged (translated) label keeps the stored name, so built-ins stay translatable.
      else await updateCategory(db, id, { ...v, name: row && v.name === categoryLabel(row) ? (row.name ?? v.name) : v.name });
      goBack('/categories');
    }),
  );

  const archive = () =>
    run(async () => {
      if (row?.archived_at) return setCategoryArchived(db, id, false);
      if (await confirm({ title: t('categories.archiveTitle'), body: t('categories.archiveBody'), confirmLabel: t('common.archive') })) {
        await setCategoryArchived(db, id, true);
        goBack('/categories');
      }
    });

  const remove = () =>
    run(async () => {
      if (await confirm({ title: t('categories.deleteTitle'), body: t('categories.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
        await deleteCategory(db, id);
        goBack('/categories');
      }
    });

  const { control } = form;
  return (
    <Screen title={isNew ? t('categories.new') : t('categories.edit')} narrow>
      <FormTextField control={control} name="name" label={t('categories.name')} autoFocus={isNew} maxLength={100} />
      {isNew && (
        <Controller control={control} name="kind" render={({ field }) => (
          <Segmented label={t('categories.kind')} value={field.value} onChange={(v) => { field.onChange(v); form.setValue('parentId', null); }}
            options={[{ value: 'expense', label: t('categories.expense') }, { value: 'income', label: t('categories.income') }]} />
        )} />
      )}
      <Controller control={control} name="icon" render={({ field }) => (
        <ChoiceGrid label={t('accounts.icon')} choices={CATEGORY_ICONS} value={field.value} onChange={field.onChange}
          render={(i, sel) => (
            <View style={[styles.iconChoice, { backgroundColor: sel ? theme.primary : theme.backgroundSelected }]}>
              <AppIcon name={i} color={sel ? theme.primaryText : theme.text} />
            </View>
          )} />
      )} />
      <Button variant="ghost" icon="chevron-down" label={showMore ? t('common.fewerOptions') : t('common.moreOptions')} onPress={() => setShowMore((v) => !v)} />
      {showMore && <>
      <Controller control={control} name="parentId" render={({ field }) => (
        <ChoiceGrid
          label={t('categories.parent')}
          choices={[NONE, ...parents.map((p) => p.id)]}
          value={field.value ?? NONE}
          onChange={(v) => field.onChange(v === NONE ? null : v)}
          labelOf={(v) => (v === NONE ? t('common.none') : categoryLabel(parents.find((p) => p.id === v)!))}
          render={(v, sel) => (
            <View style={[styles.chip, { backgroundColor: sel ? theme.primary : theme.backgroundSelected }]}>
              <ThemedText type="small" style={{ color: sel ? theme.primaryText : theme.text }}>
                {v === NONE ? t('common.none') : categoryLabel(parents.find((p) => p.id === v)!)}
              </ThemedText>
            </View>
          )}
        />
      )} />
      <Controller control={control} name="color" render={({ field }) => (
        <ChoiceGrid label={t('accounts.color')} choices={SWATCHES} value={field.value} onChange={field.onChange}
          render={(c, sel) => <View style={[styles.swatch, { backgroundColor: c, borderColor: sel ? theme.text : 'transparent' }]} />} />
      )} />
      </>}
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button variant="secondary" icon={row?.archived_at ? 'archive-restore' : 'archive'}
              label={row?.archived_at ? t('common.restore') : t('common.archive')} onPress={archive} />
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
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  iconChoice: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: Spacing.three, minHeight: 36, borderRadius: 18, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
