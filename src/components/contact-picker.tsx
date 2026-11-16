import { useQuery } from '@powersync/react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ChoiceGrid } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickedContact = { id: string; name: string; phone: string | null };
const NONE = '';

/** Optional client/supplier link for a debt or cheque. Hidden until the user has at least one contact. */
export function ContactPicker({ value, onChange }: { value: string; onChange: (c: PickedContact | null) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: contacts } = useQuery<PickedContact>('SELECT id, name, phone FROM contacts ORDER BY name');
  if (contacts.length === 0) return null;
  const nameOf = (id: string) => contacts.find((c) => c.id === id)?.name ?? t('contacts.none');
  return (
    <ChoiceGrid label={`${t('contacts.contact')} (${t('common.optional')})`} choices={[NONE, ...contacts.map((c) => c.id)]} value={value}
      onChange={(id) => onChange(contacts.find((c) => c.id === id) ?? null)} labelOf={nameOf}
      render={(id, sel) => (
        <View style={[styles.chip, { backgroundColor: sel ? theme.primary : theme.backgroundSelected }]}>
          <ThemedText type="small" style={{ color: sel ? theme.primaryText : theme.text }} numberOfLines={1}>{nameOf(id)}</ThemedText>
        </View>
      )} />
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.three, minHeight: 40, borderRadius: 20, justifyContent: 'center', maxWidth: 200 },
});
