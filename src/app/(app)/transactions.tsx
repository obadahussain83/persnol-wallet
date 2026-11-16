import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TransactionItem } from '@/components/transaction-item';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button, Card, EmptyState, IconButton, Screen, SectionTitle, Segmented, TextField } from '@/components/ui/primitives';
import { deleteTransaction } from '@/data/transactions';
import { TRANSACTIONS_LIST_SQL, type TransactionListRow } from '@/db/queries';
import { categoryLabel } from '@/i18n';
import { dayKey } from '@/lib/dates';
import { useUser } from '@/session/session-provider';

// shortcut: newest 500 only, searched in memory; add paging + SQL filters (Phase 4) when histories get long.
export default function Transactions() {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const { db } = useUser();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'personal' | 'work'>('all');
  const { data } = useQuery<TransactionListRow>(TRANSACTIONS_LIST_SQL, [500]);

  const needle = q.trim().toLowerCase();
  const rows = data
    .filter((r) => scope === 'all' || (r.scope ?? 'personal') === scope)
    .filter((r) => !needle ||
      [categoryLabel({ key: r.category_key, name: r.category_name }), r.notes, r.account_name, r.to_account_name]
        .join(' ').toLowerCase().includes(needle));

  const groups: { key: string; items: TransactionListRow[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.occurred_at);
    if (groups.at(-1)?.key !== k) groups.push({ key: k, items: [] });
    groups.at(-1)!.items.push(r);
  }
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

  const remove = async (id: string) => {
    if (await confirm({ title: t('tx.deleteTitle'), body: t('tx.deleteBody'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteTransaction(db, id);
    }
  };
  const add = () => router.push('/add');

  return (
    <Screen title={t('tx.title')} actions={<IconButton icon="plus" label={t('tx.add')} onPress={add} />}>
      {data.length === 0 ? (
        <EmptyState icon="list" title={t('tx.empty')} hint={t('tx.emptyHint')} action={<Button label={t('tx.add')} icon="plus" onPress={add} />} />
      ) : (
        <>
          <Segmented value={scope} onChange={setScope}
            options={[{ value: 'all', label: t('common.all') }, { value: 'personal', label: t('tx.personal') }, { value: 'work', label: t('tx.work') }]} />
          <TextField label={t('common.search')} value={q} onChangeText={setQ} placeholder={t('common.search')} />
          {groups.length === 0 ? <EmptyState icon="search" title={t('tx.noResults')} /> : null}
          {groups.map((g) => (
            <Card key={g.key} style={{ padding: 4, gap: 0 }}>
              <SectionTitle>{dayLabel(g.items[0].occurred_at)}</SectionTitle>
              {g.items.map((r) => <TransactionItem key={r.id} tx={r} onPress={() => remove(r.id)} />)}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
