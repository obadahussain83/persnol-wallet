import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Button, Card, EmptyState, IconBadge, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import type { ContactKind } from '@/data/contacts';
import { useTheme } from '@/hooks/use-theme';

type Row = { id: string; name: string; phone: string | null; open_count: number };

export default function Contacts() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [kind, setKind] = useState<ContactKind>('client');
  const { data } = useQuery<Row>(
    `SELECT c.id, c.name, c.phone,
       (SELECT COUNT(*) FROM debts d WHERE d.contact_id = c.id AND d.settled_at IS NULL)
       + (SELECT COUNT(*) FROM cheques q WHERE q.contact_id = c.id AND q.status = 'pending') AS open_count
     FROM contacts c WHERE c.kind = ? ORDER BY c.name`,
    [kind],
  );
  const add = () => router.push({ pathname: '/contacts/[id]', params: { id: 'new', kind } });

  return (
    <Screen title={t('contacts.title')} actions={<IconButton icon="plus" label={t('contacts.new')} onPress={add} />}>
      <Segmented<ContactKind> value={kind} onChange={setKind}
        options={[{ value: 'client', label: t('contacts.clients') }, { value: 'supplier', label: t('contacts.suppliers') }]} />
      {data.length === 0 ? (
        <EmptyState icon="user" title={t('contacts.empty')} hint={t('contacts.emptyHint')}
          action={<Button label={t('contacts.new')} icon="plus" onPress={add} />} />
      ) : data.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/contacts/${c.id}`)}>
          <View style={styles.row}>
            <IconBadge icon={kind === 'client' ? 'user' : 'building-2'} color={theme.primary} />
            <View style={styles.flex}>
              <ThemedText numberOfLines={1}>{c.name}</ThemedText>
              {c.phone ? <ThemedText type="small" themeColor="textSecondary">{c.phone}</ThemedText> : null}
            </View>
            {c.open_count > 0 ? <ThemedText type="small" style={{ color: theme.warning }}>{t('contacts.open', { count: c.open_count })}</ThemedText> : null}
            <AppIcon name="chevron-right" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
});
