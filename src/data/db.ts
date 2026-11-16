// The slice of PowerSyncDatabase the repositories use. Tests pass a node:sqlite fake (testing.ts).
// Repositories are imported by node tests too, so they use relative `.ts` imports, never `@/`.
export interface Db {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

/** Expected business-rule failure. `code` is an i18n key under `errors.`. */
export class DomainError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const nowIso = () => new Date().toISOString();

export async function newId(db: Db): Promise<string> {
  const row = await db.getOptional<{ id: string }>('SELECT uuid() AS id');
  if (!row) throw new Error('uuid() failed');
  return row.id;
}
