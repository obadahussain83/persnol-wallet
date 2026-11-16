import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card, EmptyState, IconBadge, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { type CategoryKind, orderCategoryTree } from '@/data/categories';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';

type Row = { id: string; key: string | null; name: string | null; parent_id: string | null; color: string | null; icon: string | null; archived_at: string | null };

export default function Categories() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [showArchived, setShowArchived] = useState<'no' | 'yes'>('no');
  const { data } = useQuery<Row>(
    `SELECT id, key, name, parent_id, color, icon, archived_at FROM categories
     WHERE kind = ? ${showArchived === 'yes' ? '' : 'AND archived_at IS NULL'}`,
    [kind],
  );
  const tree = orderCategoryTree(data, categoryLabel);

  return (
    <Screen
      title={t('categories.title')}
      actions={<IconButton icon="plus" label={t('categories.new')} onPress={() => router.push({ pathname: '/categories/[id]', params: { id: 'new', kind } })} />}>
      <Segmented options={[{ value: 'expense', label: t('categories.expense') }, { value: 'income', label: t('categories.income') }]} value={kind} onChange={setKind} />
      <Segmented options={[{ value: 'no', label: t('categories.title') }, { value: 'yes', label: t('common.showArchived') }]} value={showArchived} onChange={setShowArchived} />
      {tree.length === 0 ? (
        <EmptyState icon="tags" title={t('categories.empty')} />
      ) : (
        <Card style={styles.list}>
          {tree.map(({ row, depth }) => (
            <Card key={row.id} onPress={() => router.push(`/categories/${row.id}`)}
              style={{ ...styles.item, marginStart: depth * Spacing.five, opacity: row.archived_at ? 0.55 : 1, borderColor: 'transparent' }}>
              <View style={styles.row}>
                <IconBadge icon={row.icon ?? 'tag'} color={row.color ?? theme.primary} size={depth ? 32 : 36} />
                <ThemedText style={styles.flex} numberOfLines={1}>{categoryLabel(row)}</ThemedText>
                {row.archived_at ? <ThemedText type="small" themeColor="textSecondary">{t('common.archived')}</ThemedText> : null}
                <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
            </Card>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.one, gap: 0 },
  item: { paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
