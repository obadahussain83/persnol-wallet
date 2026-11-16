import { useQuery } from '@powersync/react';

import type { Mode } from '@/data/profile';
import { useUser } from '@/session/session-provider';

/**
 * The user's chosen mode. `loaded` is false until the profile row is on this device (it syncs down after signup);
 * `mode` is null when loaded but not chosen yet. Anything not explicitly personal behaves as business, so features
 * never disappear while the profile is still loading.
 */
export function useMode(): { mode: Mode | null; loaded: boolean; isBusiness: boolean } {
  const { userId } = useUser();
  const { data } = useQuery<{ mode: Mode | null }>('SELECT mode FROM profiles WHERE id = ?', [userId]);
  const mode = data[0]?.mode ?? null;
  return { mode, loaded: data.length > 0, isBusiness: mode !== 'personal' };
}
