import { useQuery } from '@powersync/react';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { generateDue } from '@/data/recurring';
import { useUser } from '@/session/session-provider';

/**
 * Turns due recurring rules into transactions: on start, whenever the rules change (including when they first
 * sync down on a new device), and when the app returns to the foreground (e.g. the next day).
 */
export function useRecurringGenerator() {
  const { db, userId } = useUser();
  const { data } = useQuery<{ k: string }>("SELECT COALESCE(group_concat(id || ':' || updated_at), '') AS k FROM recurring");
  const rulesKey = data[0]?.k;
  const running = useRef(false);

  useEffect(() => {
    if (rulesKey === undefined) return;
    const run = async () => {
      if (running.current) return; // occurrence ids are deterministic, but two overlapping runs would race on insert
      running.current = true;
      try {
        await generateDue(db, userId);
      } catch (e) {
        console.warn('recurring generation failed', e);
      } finally {
        running.current = false;
      }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [db, userId, rulesKey]);
}
