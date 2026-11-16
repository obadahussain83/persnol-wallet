import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { errorMessage } from '@/components/ui/form';
import { Button, ChoiceGrid, EmptyState, IconBadge, Screen, Segmented, TextField } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/theme';
import { orderCategoryTree } from '@/data/categories';
import { createRecurring, generateDue } from '@/data/recurring';
import { createTransaction, createTransfer } from '@/data/transactions';
import { ACCOUNT_BALANCES_SQL, type AccountBalance, QUICK_ADD_SQL, type QuickAdd } from '@/db/queries';
import { useMode } from '@/hooks/use-mode';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/i18n';
import { dayKey, daysAgoIso } from '@/lib/dates';
import { formatMoney, toDecimalString } from '@/lib/money';
import { goBack } from '@/lib/navigation';
import { useUser } from '@/session/session-provider';

type Kind = 'expense' | 'income' | 'transfer';
type Cat = { id: string; key: string | null; name: string | null; parent_id: string | null; color: string | null; icon: string | null; uses: number };
type Scope = 'personal' | 'work';
type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly';

// Quick add: type → amount → category (or destination account) → save. Today is preselected.
export default function AddTransaction() {
  const p = useLocalSearchParams<{ type?: Kind; amount?: string; note?: string }>();
  // The tab stays mounted, so a new prefill (e.g. from a cleared cheque) must remount the form to take effect.
  return <AddForm key={`${p.type ?? ''}|${p.amount ?? ''}|${p.note ?? ''}`} />;
}

function AddForm() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { db, userId } = useUser();
  // amount/note can be prefilled, e.g. when a cleared cheque is recorded.
  const params = useLocalSearchParams<{ type?: Kind; amount?: string; note?: string }>();
  const [kind, setKind] = useState<Kind>(params.type ?? 'expense');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [toAmount, setToAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const [scope, setScope] = useState<Scope>('personal');
  const { isBusiness } = useMode(); // personal mode: everything is personal, no scope choice
  const [note, setNote] = useState(params.note ?? '');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);

  const { data: accounts } = useQuery<AccountBalance>(ACCOUNT_BALANCES_SQL);
  // Most-used categories first, so everyday expenses are one tap away.
  const { data: cats } = useQuery<Cat>(
    `SELECT c.id, c.key, c.name, c.parent_id, c.color, c.icon,
       (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id AND t.deleted_at IS NULL) AS uses
     FROM categories c WHERE c.kind = ? AND c.archived_at IS NULL`,
    [kind === 'income' ? 'income' : 'expense'],
  );
  const quickSince = useMemo(() => daysAgoIso(90), []);
  const { data: quick } = useQuery<QuickAdd>(QUICK_ADD_SQL, [quickSince]);
  const { data: last } = useQuery<{ account_id: string }>(
    'SELECT account_id FROM transactions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1');

  // Default to the account used last time.
  const from = accounts.find((a) => a.id === accountId) ?? accounts.find((a) => a.id === last[0]?.account_id) ?? accounts[0];
  const destinations = accounts.filter((a) => a.id !== from?.id);
  const to = destinations.find((a) => a.id === toAccountId) ?? destinations[0];
  const categories = orderCategoryTree(cats, categoryLabel).map((x) => x.row).sort((a, b) => b.uses - a.uses);

  if (accounts.length === 0) {
    return (
      <Screen title={t('tx.add')} narrow>
        <EmptyState icon="wallet" title={t('tx.noAccounts')} hint={t('tx.noAccountsHint')}
          action={<Button label={t('accounts.new')} icon="plus" onPress={() => router.push('/accounts/new')} />} />
      </Screen>
    );
  }

  const save = async (now: Date) => {
    setError(null);
    setSaving(true);
    const occurredAt = new Date(now.getTime() - (when === 'yesterday' ? 86_400_000 : 0)).toISOString();
    try {
      if (kind === 'transfer') {
        await createTransfer(db, userId, { fromAccountId: from?.id ?? '', toAccountId: to?.id ?? '', amount, toAmount, occurredAt, note });
      } else if (repeat !== 'none') {
        // The rule creates this first occurrence (and any later ones) itself.
        await createRecurring(db, userId, {
          type: kind, accountId: from?.id ?? '', categoryId, amount, note, scope, frequency: repeat, startDate: dayKey(occurredAt),
        });
        await generateDue(db, userId, now);
      } else {
        await createTransaction(db, userId, { type: kind, accountId: from?.id ?? '', categoryId, amount, occurredAt, note, scope });
      }
      goBack('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const chip = (label: string, selected: boolean) => (
    <View style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: selected ? theme.primaryText : theme.text }} numberOfLines={1}>{label}</ThemedText>
    </View>
  );
  // Refill the form from a repeated transaction; the user still reviews and taps Save.
  const applyQuick = (q: QuickAdd) => {
    setKind(q.type);
    setAmount(toDecimalString(q.amount_minor, q.currency));
    setAccountId(q.account_id);
    setCategoryId(q.category_id);
    setScope(isBusiness ? q.scope : 'personal');
    setNote(q.notes ?? '');
    setError(null);
  };
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';
  const amountColor = kind === 'expense' ? theme.expense : kind === 'income' ? theme.income : theme.text;

  return (
    <Screen title={t('tx.add')} narrow>
      <Segmented<Kind>
        value={kind}
        onChange={(k) => { setKind(k); setCategoryId(''); setError(null); }}
        options={[{ value: 'expense', label: t('tx.expense') }, { value: 'income', label: t('tx.income') }, { value: 'transfer', label: t('tx.transfer') }]}
      />
      {quick.length > 0 && (
        <View style={styles.quickWrap} accessibilityLabel={t('tx.quickAdd')}>
          {quick.map((q) => (
            <Pressable key={`${q.account_id}|${q.category_id}|${q.amount_minor}|${q.notes}|${q.scope}`} accessibilityRole="button" onPress={() => applyQuick(q)}
              style={[styles.quick, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
              <IconBadge icon={q.category_icon ?? 'tag'} color={q.category_color ?? theme.primary} size={24} />
              <ThemedText type="small" numberOfLines={1} style={styles.quickText}>
                {q.notes || categoryLabel({ key: q.category_key, name: q.category_name })}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: q.type === 'income' ? theme.income : theme.expense }}>
                {formatMoney(q.amount_minor, q.currency, i18n.language)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.amountBox, {
        backgroundColor: theme.backgroundElement,
        borderColor: amountFocused ? theme.primary : theme.border,
      }]}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          onFocus={() => setAmountFocused(true)}
          onBlur={() => setAmountFocused(false)}
          placeholder="0"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          inputMode="decimal"
          underlineColorAndroid="transparent"
          autoFocus
          accessibilityLabel={t('tx.amount')}
          style={[styles.amount, { color: amountColor }]}
        />
        <ThemedText type="smallBold" themeColor="textSecondary">{from?.currency}</ThemedText>
      </View>

      <ChoiceGrid label={kind === 'transfer' ? t('tx.from') : t('tx.account')} choices={accounts.map((a) => a.id)} value={from?.id ?? ''}
        onChange={setAccountId} labelOf={nameOf} render={(id, sel) => chip(nameOf(id), sel)} />

      {kind === 'transfer' ? (
        <>
          <ChoiceGrid label={t('tx.to')} choices={destinations.map((a) => a.id)} value={to?.id ?? ''}
            onChange={setToAccountId} labelOf={nameOf} render={(id, sel) => chip(nameOf(id), sel)} />
          {to && from && to.currency !== from.currency ? (
            <TextField label={t('tx.toAmount', { currency: to.currency })} value={toAmount} onChangeText={setToAmount} keyboardType="decimal-pad" inputMode="decimal" />
          ) : null}
        </>
      ) : (
        <ChoiceGrid
          label={t('tx.category')}
          choices={categories.map((c) => c.id)}
          value={categoryId}
          onChange={setCategoryId}
          labelOf={(id) => categoryLabel(categories.find((c) => c.id === id)!)}
          render={(id, sel) => {
            const c = categories.find((x) => x.id === id)!;
            return (
              <View style={[styles.tile, sel && { backgroundColor: theme.backgroundSelected, borderColor: theme.primary }]}>
                <IconBadge icon={c.icon ?? 'tag'} color={c.color ?? theme.primary} size={40} />
                <ThemedText type="small" numberOfLines={1} style={styles.tileText}>{categoryLabel(c)}</ThemedText>
              </View>
            );
          }}
        />
      )}

      {kind !== 'transfer' && isBusiness && (
        <Segmented<Scope> label={t('tx.scope')} value={scope} onChange={setScope}
          options={[{ value: 'personal', label: t('tx.personal') }, { value: 'work', label: t('tx.work') }]} />
      )}
      <Segmented label={t('tx.date')} value={when} onChange={setWhen}
        options={[{ value: 'today', label: t('common.today') }, { value: 'yesterday', label: t('common.yesterday') }]} />
      {kind !== 'transfer' && (
        <Segmented<Repeat> label={t('recurring.repeat')} value={repeat} onChange={setRepeat}
          options={[{ value: 'none', label: t('recurring.none') }, { value: 'weekly', label: t('recurring.weekly') },
            { value: 'monthly', label: t('recurring.monthly') }, { value: 'yearly', label: t('recurring.yearly') }]} />
      )}
      <TextField label={`${t('tx.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} maxLength={500} />

      {error ? <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <Button label={t('common.save')} icon="check" onPress={() => save(new Date())} loading={saving} testID="save" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quick: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, minHeight: 40, borderRadius: 20, borderWidth: 1, maxWidth: 260 },
  quickText: { flexShrink: 1 },
  amountBox: { borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.three, alignItems: 'center', gap: Spacing.one },
  amount: {
    width: '100%',
    borderWidth: 0,
    padding: 0,
    backgroundColor: 'transparent',
    fontSize: 44,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    // Chrome's focus ring is `outline-style: auto`, which ignores outline-width; the box border shows focus instead.
    outlineStyle: 'none' as 'solid', // valid on web; missing from the RN style types
  },
  chip: { paddingHorizontal: Spacing.three, minHeight: 40, borderRadius: 20, justifyContent: 'center', maxWidth: 200 },
  tile: { width: 80, alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two, borderRadius: Radius.md, borderWidth: 2, borderColor: 'transparent' },
  tileText: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
});
