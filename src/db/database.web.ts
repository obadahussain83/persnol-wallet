import { PowerSyncDatabase, WASQLiteOpenFactory } from '@powersync/web';

import { AppSchema } from './schema';

// Web: wa-sqlite persisted in IndexedDB, running in PowerSync's prebuilt UMD workers.
// Metro can't bundle those workers or their wasm, so `npm run powersync:assets` copies them
// into public/@powersync (also runs on postinstall) and we load them by URL.
// One database per user (see database.ts).
export function openDatabase(userId: string) {
  const dbFilename = `wallet-${userId}.sqlite`;
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({ dbFilename, worker: '/@powersync/worker/WASQLiteDB.umd.js' }),
    sync: { worker: '/@powersync/worker/SharedSyncImplementation.umd.js' },
  });
}
