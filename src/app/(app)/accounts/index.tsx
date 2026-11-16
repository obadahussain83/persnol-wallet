import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountCard } from '@/components/account-card';
import { Button, EmptyState, IconButton, Screen, Segmented } from '@/components/ui/primitives';
import { ACCOUNT_BALANCES_SQL, ALL_ACCOUNT_BALANCES_SQL, type AccountBalance } from '@/db/queries';

export default function Accounts() {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState<'no' | 'yes'>('no');
  const { data: accounts } = useQuery<AccountBalance>(showArchived === 'yes' ? ALL_ACCOUNT_BALANCES_SQL : ACCOUNT_BALANCES_SQL);
  const add = () => router.push('/accounts/new');

  return (
    <Screen title={t('accounts.title')} actions={<IconButton icon="plus" label={t('accounts.new')} onPress={add} />}>
      <Segmented
        options={[{ value: 'no', label: t('nav.accounts') }, { value: 'yes', label: t('common.showArchived') }]}
        value={showArchived}
        onChange={setShowArchived}
      />
      {accounts.length === 0 ? (
        <EmptyState icon="wallet" title={t('accounts.empty')} hint={t('accounts.emptyHint')}
          action={<Button label={t('accounts.new')} icon="plus" onPress={add} />} />
      ) : (
        accounts.map((a) => <AccountCard key={a.id} account={a} onPress={() => router.push(`/accounts/${a.id}`)} />)
      )}
    </Screen>
  );
}
