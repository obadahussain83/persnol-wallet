/// <reference types="node" />
// Test-only: an in-memory SQLite DB with the app's real local schema, behind the `Db` interface.
import { DatabaseSync } from 'node:sqlite';

import { AppSchema } from '../db/schema.ts';
import type { Db } from './db.ts';

export function createTestDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.function('uuid', () => crypto.randomUUID());
  for (const t of AppSchema.tables) {
    raw.exec(`CREATE TABLE ${t.name} (id TEXT PRIMARY KEY, ${t.columns.map((c) => c.name).join(', ')})`);
  }
  const p = (params: unknown[] = []) => params as (string | number | null)[];
  return {
    raw,
    execute: async (sql, params) => raw.prepare(sql).run(...p(params)),
    getAll: async <T,>(sql: string, params?: unknown[]) => raw.prepare(sql).all(...p(params)) as T[],
    getOptional: async <T,>(sql: string, params?: unknown[]) =>
      (raw.prepare(sql).get(...p(params)) as T | undefined) ?? null,
  };
}
