import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

// Native (iOS/Android): SQLite via @journeyapps/react-native-quick-sqlite. Needs a dev build, not Expo Go.
// One file per user: a second account on the same device never sees the first one's data,
// and a signed-out user's unsynced changes wait in their own file until they sign in again.
export function openDatabase(userId: string) {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: `wallet-${userId}.sqlite` },
  });
}
