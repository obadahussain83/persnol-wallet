import type { AbstractPowerSyncDatabase as PowerSyncDatabase } from '@powersync/common';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { seedLocalOnlyUser } from '@/data/profile';
import { openDatabase } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { SupabaseConnector } from '@/sync/supabase-connector';

export type Session = { userId: string; email: string | null; localOnly: boolean };
type Ctx = {
  session: Session | null;
  db: PowerSyncDatabase | null;
  /** Auth state known and, if signed in, the user's local DB is open (or failed to open). */
  ready: boolean;
  /** Set when the local DB couldn't be opened; the UI shows it with a retry instead of a blank screen. */
  dbError: unknown;
  retryDb: () => void;
  pendingUploads: () => Promise<number>;
  /** Local data and the upload queue stay in this user's DB file; nothing is discarded. */
  signOut: () => Promise<void>;
};

// Without cloud config the app runs as a single local user (development / offline-only use).
const LOCAL_SESSION: Session = { userId: 'local', email: null, localOnly: true };

const toSession = (s: SupabaseSession | null): Session | null =>
  s ? { userId: s.user.id, email: s.user.email ?? null, localOnly: false } : null;

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authKnown, setAuthKnown] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(supabase ? null : LOCAL_SESSION);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [dbError, setDbError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    // getSession reads storage, so a signed-in user gets in offline too.
    supabase.auth.getSession().then(({ data }) => {
      setSession(toSession(data.session));
      setAuthKnown(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // Token refreshes create new objects; keep the old one so the DB isn't reopened.
      setSession((prev) => (prev?.userId === s?.user.id && prev?.email === (s?.user.email ?? null) ? prev : toSession(s)));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.userId;
  const localOnly = session?.localOnly;
  useEffect(() => {
    if (!userId) return;
    const database = openDatabase(userId);
    let closed = false;
    setDbError(null);
    (async () => {
      await database.init();
      if (localOnly) await seedLocalOnlyUser(database, userId);
      else database.connect(new SupabaseConnector()).catch((e) => console.warn('Sync connect failed; will retry', e));
      if (!closed) setDb(database);
    })().catch((e) => {
      console.error('Opening the local database failed', e);
      if (!closed) setDbError(e);
    });
    return () => {
      closed = true;
      setDb(null);
      database.disconnect().finally(() => database.close());
    };
  }, [userId, localOnly, attempt]);

  const value: Ctx = {
    session,
    db,
    ready: authKnown && (!session || !!db || !!dbError),
    dbError,
    retryDb: () => setAttempt((n) => n + 1),
    pendingUploads: async () => (db ? (await db.getUploadQueueStats()).count : 0),
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.warn('Sign-out request failed; local session cleared anyway', error);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** For screens inside the signed-in area, where a session and DB always exist. */
export function useUser() {
  const { session, db } = useSession();
  if (!session || !db) throw new Error('useUser outside the signed-in area');
  return { ...session, db };
}
