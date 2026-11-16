import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage, FormTextField } from '@/components/ui/form';
import { Button, Card, EmptyState, Screen, SectionTitle, Segmented } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import {
  CONTACT_BALANCE_SQL, type ContactBalance, type ContactKind, contactInputSchema, createContact, deleteContact, updateContact,
} from '@/data/contacts';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Row = { id: string; name: string; kind: ContactKind; phone: string | null; note: string | null };
type Item = { id: string; what: 'debt' | 'cheque'; direction: string; amount_minor: number; currency: string; open: number; date: string };

export default function ContactForm() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: ContactKind }>();
  const isNew = id === 'new';
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM contacts WHERE id = ?', [id]);
  const { data: balances } = useQuery<ContactBalance>(CONTACT_BALANCE_SQL, [id, id]);
  // Everything linked to this contact, newest first: debts (remaining shown) and cheques.
  const { data: items } = useQuery<Item>(
    `SELECT d.id, 'debt' AS what, d.direction, d.currency, d.created_at AS date, d.settled_at IS NULL AS open,
       d.amount_minor - COALESCE((SELECT SUM(p.amount_minor) FROM debt_payments p WHERE p.debt_id = d.id), 0) AS amount_minor
     FROM debts d WHERE d.contact_id = ?
     UNION ALL
     SELECT c.id, 'cheque', c.direction, c.currency, c.due_date, c.status = 'pending', c.amount_minor
     FROM cheques c WHERE c.contact_id = ?
     ORDER BY open DESC, date DESC`,
    [id, id],
  );
  const row = rows[0];
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(contactInputSchema),
    defaultValues: { name: '', kind: (kindParam === 'supplier' ? 'supplier' : 'client') as ContactKind, phone: '', note: '' },
  });
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!row || loaded.current === row.id) return;
    loaded.current = row.id;
    form.reset({ name: row.name, kind: row.kind, phone: row.phone ?? '', note: row.note ?? '' });
  }, [row, form]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('contacts.edit')}><EmptyState icon="user" title={t('errors.notFound')} /></Screen>;
  }

  const save = form.handleSubmit(async (v) => {
    setError(null);
    try {
      if (isNew) await createContact(db, userId, v);
      else await updateContact(db, id, v);
      goBack('/contacts');
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  const remove = async () => {
    if (await confirm({ title: t('contacts.deleteTitle'), body: t('contacts.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteContact(db, id);
      goBack('/contacts');
    }
  };
  const money = (m: number, c: string) => formatMoney(m, c, i18n.language);
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const linked = { contactId: id, person: row?.name ?? '', phone: row?.phone ?? '' };
  const itemLabel = (it: Item) => it.what === 'debt'
    ? t(it.direction === 'owed_to_me' ? 'debts.owedToMe' : 'debts.iOwe')
    : `${t('cheques.cheque')} · ${t(it.direction === 'incoming' ? 'cheques.incoming' : 'cheques.outgoing')}`;

  const { control } = form;
  return (
    <Screen title={isNew ? t('contacts.new') : row?.name ?? t('contacts.edit')} narrow>
      {!isNew && (
        <>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">{t('contacts.balance')}</ThemedText>
            {balances.length === 0 ? <ThemedText type="smallBold">{t('contacts.settledUp')}</ThemedText> : balances.map((b) => (
              <View key={b.currency} style={styles.between}>
                <ThemedText type="small" style={{ color: theme.income }}>{t('contacts.owesMe', { amount: money(b.owed_to_me_minor, b.currency) })}</ThemedText>
                <ThemedText type="small" style={{ color: theme.expense }}>{t('contacts.iOweThem', { amount: money(b.i_owe_minor, b.currency) })}</ThemedText>
              </View>
            ))}
          </Card>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button variant="secondary" icon="coins" label={t('debts.new')} onPress={() => router.push({ pathname: '/debts/[id]', params: { id: 'new', ...linked } })} />
            </View>
            <View style={styles.flex}>
              <Button variant="secondary" icon="receipt" label={t('cheques.new')} onPress={() => router.push({ pathname: '/cheques/[id]', params: { id: 'new', ...linked } })} />
            </View>
          </View>
          {items.length > 0 && (
            <>
              <SectionTitle>{t('contacts.statement')}</SectionTitle>
              <Card>
                {items.map((it) => (
                  <Pressable key={it.id} accessibilityRole="link" style={[styles.between, { opacity: it.open ? 1 : 0.55 }]}
                    onPress={() => router.push(it.what === 'debt' ? `/debts/${it.id}` : `/cheques/${it.id}`)}>
                    <View style={styles.flex}>
                      <ThemedText numberOfLines={1}>{itemLabel(it)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{date.format(new Date(it.date.length === 10 ? `${it.date}T12:00:00` : it.date))}</ThemedText>
                    </View>
                    <ThemedText type="smallBold">{money(it.amount_minor, it.currency)}</ThemedText>
                  </Pressable>
                ))}
              </Card>
            </>
          )}
          <SectionTitle>{t('contacts.details')}</SectionTitle>
        </>
      )}
      <Controller control={control} name="kind" render={({ field }) => (
        <Segmented value={field.value} onChange={field.onChange}
          options={[{ value: 'client', label: t('contacts.client') }, { value: 'supplier', label: t('contacts.supplier') }]} />
      )} />
      <FormTextField control={control} name="name" label={t('contacts.name')} autoFocus={isNew} maxLength={100} />
      <FormTextField control={control} name="phone" label={`${t('debts.phone')} (${t('common.optional')})`} placeholder="+970 59 123 4567" inputMode="tel" maxLength={30} />
      <FormTextField control={control} name="note" label={`${t('tx.note')} (${t('common.optional')})`} multiline maxLength={500} />
      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} onPress={save} loading={form.formState.isSubmitting} testID="save" />
      {!isNew && <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, minHeight: 44 },
});
