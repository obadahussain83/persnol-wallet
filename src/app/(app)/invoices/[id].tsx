import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ContactPicker } from '@/components/contact-picker';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { errorMessage } from '@/components/ui/form';
import { Button, Card, EmptyState, Screen, SectionTitle, Segmented, TextField } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import { whatsappUrl } from '@/data/debts';
import {
  createInvoice, deleteInvoice, type InvoiceInput, type InvoiceKind, type InvoiceStatus, invoiceTotal, lineTotal, parseItems,
  quoteToInvoice, setInvoiceStatus, updateInvoice,
} from '@/data/invoices';
import { useTheme } from '@/hooks/use-theme';
import { isRtlLanguage, type Language } from '@/i18n';
import { dayKey } from '@/lib/dates';
import { invoiceHtml } from '@/lib/invoice-html';
import { formatMoney, parseAmount, toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Currency = (typeof CURRENCIES)[number];
type Row = {
  id: string; kind: InvoiceKind; number: string; contact_id: string | null; client_name: string; currency: Currency; issue_date: string;
  due_date: string | null; items: string; total_minor: number; note: string | null; status: InvoiceStatus;
};
type Line = { description: string; quantity: string; unitPrice: string };
const emptyLine = (): Line => ({ description: '', quantity: '1', unitPrice: '' });

export default function InvoiceForm() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: InvoiceKind }>();
  const isNew = id === 'new';
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const confirm = useConfirm();
  const { db, userId, email } = useUser();
  const { data: rows, isLoading } = useQuery<Row>('SELECT * FROM invoices WHERE id = ?', [id]);
  const { data: profile } = useQuery<{ display_name: string | null; primary_currency: string }>(
    'SELECT display_name, primary_currency FROM profiles WHERE id = ?', [userId]);
  const { data: contactRows } = useQuery<{ phone: string | null }>('SELECT phone FROM contacts WHERE id = ?', [rows[0]?.contact_id ?? '']);
  const row = rows[0];
  const kind: InvoiceKind = row?.kind ?? (kindParam === 'quote' ? 'quote' : 'invoice');

  const [contactId, setContactId] = useState('');
  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [issueDate, setIssueDate] = useState(dayKey(new Date().toISOString()));
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill the form once per loaded record (live query updates after our own save must not reset it).
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (isNew && profile[0] && !loaded.current) {
      loaded.current = 'new';
      setCurrency(profile[0].primary_currency as Currency);
    }
    if (!row || loaded.current === row.id) return;
    loaded.current = row.id;
    setContactId(row.contact_id ?? '');
    setClientName(row.client_name);
    setCurrency(row.currency);
    setIssueDate(row.issue_date);
    setDueDate(row.due_date ?? '');
    setLines(parseItems(row.items).map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: toDecimalString(it.unit_price_minor, row.currency) })));
    setNote(row.note ?? '');
  }, [row, profile, isNew]);

  if (!isNew && !isLoading && !row) {
    return <Screen title={t('invoices.edit')}><EmptyState icon="receipt" title={t('errors.notFound')} /></Screen>;
  }

  const locked = row?.status === 'paid';
  const money = (m: number) => formatMoney(m, currency, i18n.language);
  // Live total; lines that don't parse yet count as zero.
  const lineMinor = (l: Line) => {
    try {
      return lineTotal(parseAmount(l.unitPrice || '0', currency), l.quantity);
    } catch {
      return 0;
    }
  };
  const total = lines.reduce((a, l) => a + lineMinor(l), 0);
  const input = (): InvoiceInput => ({ kind, contactId, clientName, currency, issueDate, dueDate, items: lines, note });
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      if (isNew) await createInvoice(db, userId, input());
      else await updateInvoice(db, id, input());
      goBack('/invoices');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const printable = () => {
    if (!row) return null;
    const items = parseItems(row.items);
    return invoiceHtml({ ...row, items }, {
      title: t(row.kind === 'invoice' ? 'invoices.invoice' : 'invoices.quote'), number: t('invoices.number'), date: t('tx.date'),
      due: t('invoices.dueDate'), billTo: t('invoices.billTo'), description: t('invoices.item'), quantity: t('invoices.quantity'),
      unitPrice: t('invoices.unitPrice'), amount: t('tx.amount'), total: t('invoices.total'), from: t('invoices.from'),
    }, { locale: i18n.language, rtl: isRtlLanguage(i18n.language as Language), seller: profile[0]?.display_name || email || '' });
  };
  // shortcut: web prints through the browser (Save as PDF); phones need expo-print + a new dev build.
  const print = () => {
    const html = printable();
    const w = html ? window.open('', '_blank') : null;
    if (!w || !html) { setError(t('invoices.popupBlocked')); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };
  const share = () => {
    if (!row) return;
    const items = parseItems(row.items);
    const text = [
      `${t(row.kind === 'invoice' ? 'invoices.invoice' : 'invoices.quote')} ${row.number}`,
      ...items.map((it) => `• ${it.description} × ${it.quantity} = ${formatMoney(lineTotal(it.unit_price_minor, it.quantity), row.currency, i18n.language)}`),
      `${t('invoices.total')}: ${formatMoney(invoiceTotal(items), row.currency, i18n.language)}`,
      row.due_date ? `${t('invoices.dueDate')}: ${row.due_date}` : '',
    ].filter(Boolean).join('\n');
    Linking.openURL(whatsappUrl(contactRows[0]?.phone ?? null, text));
  };
  const markPaid = async () => {
    if (!row) return;
    await setInvoiceStatus(db, id, 'paid');
    if (await confirm({ title: t('cheques.recordTitle'), body: t('invoices.recordBody'), confirmLabel: t('cheques.record') })) {
      router.replace({ pathname: '/add', params: { type: 'income', amount: toDecimalString(row.total_minor, row.currency), note: `${row.number} · ${row.client_name}` } });
    }
  };
  const convert = async () => {
    const newId = await quoteToInvoice(db, userId, id);
    router.replace(`/invoices/${newId}`);
  };
  const remove = async () => {
    if (await confirm({ title: t('invoices.deleteTitle'), body: t('categories.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteInvoice(db, id);
      goBack('/invoices');
    }
  };
  const status = (s: InvoiceStatus) => setInvoiceStatus(db, id, s);

  const title = isNew ? t(kind === 'invoice' ? 'invoices.new' : 'invoices.newQuote') : `${row?.number ?? ''}`;
  return (
    <Screen title={title} narrow>
      {row && <ThemedText type="small" themeColor="textSecondary">{t(`invoices.status.${row.status}`)}{locked ? ` · ${t('invoices.lockedHint')}` : ''}</ThemedText>}
      <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.stack, locked && { opacity: 0.6 }]}>
        <ContactPicker value={contactId} onChange={(c) => { setContactId(c?.id ?? ''); if (c) setClientName(c.name); }} />
        <TextField label={t('invoices.client')} value={clientName} onChangeText={setClientName} maxLength={100} />
        <Segmented label={t('accounts.currency')} value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <View style={styles.row}>
          <View style={styles.flex}><TextField label={t('invoices.issueDate')} value={issueDate} onChangeText={setIssueDate} inputMode="numeric" /></View>
          <View style={styles.flex}><TextField label={`${t('invoices.dueDate')} (${t('common.optional')})`} value={dueDate} onChangeText={setDueDate} placeholder="2026-12-01" inputMode="numeric" /></View>
        </View>

        <SectionTitle>{t('invoices.items')}</SectionTitle>
        {lines.map((l, i) => (
          <Card key={i}>
            <View style={styles.row}>
              <View style={styles.flex}><TextField label={t('invoices.item')} value={l.description} onChangeText={(v) => setLine(i, { description: v })} maxLength={200} /></View>
              {lines.length > 1 && (
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10} onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                  <AppIcon name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}><TextField label={t('invoices.quantity')} value={l.quantity} onChangeText={(v) => setLine(i, { quantity: v })} inputMode="decimal" keyboardType="decimal-pad" /></View>
              <View style={styles.flex}><TextField label={t('invoices.unitPrice')} value={l.unitPrice} onChangeText={(v) => setLine(i, { unitPrice: v })} inputMode="decimal" keyboardType="decimal-pad" /></View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.end}>{money(lineMinor(l))}</ThemedText>
          </Card>
        ))}
        <Button variant="secondary" icon="plus" label={t('invoices.addItem')} onPress={() => setLines((ls) => [...ls, emptyLine()])} />
        <View style={styles.totalRow}>
          <ThemedText type="smallBold">{t('invoices.total')}</ThemedText>
          <ThemedText type="subtitle">{money(total)}</ThemedText>
        </View>
        <TextField label={`${t('tx.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} multiline maxLength={1000} />
      </View>

      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      {!locked && <Button label={t('common.save')} onPress={save} loading={saving} testID="save" />}

      {row && (
        <>
          <View style={styles.row}>
            {Platform.OS === 'web' && <View style={styles.flex}><Button variant="secondary" icon="download" label={t('invoices.pdf')} onPress={print} /></View>}
            <View style={styles.flex}><Button variant="secondary" icon="message-circle" label={t('invoices.whatsapp')} onPress={share} /></View>
          </View>
          {row.kind === 'invoice' && row.status === 'draft' && <Button variant="secondary" icon="check" label={t('invoices.markSent')} onPress={() => status('sent')} />}
          {row.kind === 'invoice' && (row.status === 'draft' || row.status === 'sent') && <Button variant="secondary" icon="coins" label={t('invoices.markPaid')} onPress={markPaid} />}
          {row.kind === 'quote' && row.status !== 'cancelled' && <Button variant="secondary" icon="arrow-left-right" label={t('invoices.toInvoice')} onPress={convert} />}
          {(row.status === 'paid' || row.status === 'cancelled') && <Button variant="secondary" icon="refresh-cw" label={t('invoices.reopen')} onPress={() => status('draft')} />}
          {row.status !== 'paid' && row.status !== 'cancelled' && <Button variant="secondary" icon="x" label={t('invoices.cancel')} onPress={() => status('cancelled')} />}
          <Button variant="secondary" icon="trash" label={t('common.delete')} onPress={remove} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  end: { textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.one },
});
