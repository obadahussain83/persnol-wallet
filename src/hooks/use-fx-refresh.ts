import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshRates } from '@/data/fx';
import { useUser } from '@/session/session-provider';

/** Keeps exchange rates fresh: on start and when the app returns to the foreground. Offline is fine; old rates stay. */
export function useFxRefresh() {
  const { db } = useUser();
  useEffect(() => {
    const run = () => { refreshRates(db).catch((e) => console.warn('rates refresh failed', e)); };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [db]);
}
