import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';

import { powersyncUrl, supabase } from '@/lib/supabase';

// Bridges PowerSync's local upload queue to Supabase. Every write carries a client-generated UUID,
// so a retried upsert is idempotent and never creates a duplicate row.
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    if (!supabase || !powersyncUrl) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return { endpoint: powersyncUrl, token: data.session.access_token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    if (!supabase) return;
    const tx = await database.getNextCrudTransaction();
    if (!tx) return;

    for (const op of tx.crud) {
      const table = supabase.from(op.table);
      const { error } =
        op.op === UpdateType.PUT
          ? // PUT = local insert. Ignore duplicates so a retried upload never clobbers a newer edit.
            await table.upsert({ ...op.opData, id: op.id }, { ignoreDuplicates: true })
          : op.op === UpdateType.PATCH
            ? await table.update(op.opData ?? {}).eq('id', op.id)
            : await table.delete().eq('id', op.id);
      // Throwing keeps the op in the local queue; PowerSync retries later. Nothing is discarded.
      // shortcut: a permanently rejected op blocks the queue; Phase 3 adds a failed-ops table + UI.
      if (error) throw error;
    }
    await tx.complete();
  }
}
