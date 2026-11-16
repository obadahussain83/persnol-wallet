import { z } from 'zod';

import { type Db, DomainError, newId, nowIso } from './db.ts';

export const CATEGORY_KINDS = ['expense', 'income'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  kind: z.enum(CATEGORY_KINDS),
  parentId: z.string().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid'),
  icon: z.string().min(1, 'required'),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

type Row = { id: string; kind: string; parent_id: string | null; archived_at: string | null };
const get = (db: Db, id: string) =>
  db.getOptional<Row>('SELECT id, kind, parent_id, archived_at FROM categories WHERE id = ?', [id]);

// One level of nesting: a parent must be an active top-level category of the same kind.
async function checkParent(db: Db, selfId: string | null, kind: string, parentId: string | null) {
  if (!parentId) return;
  if (parentId === selfId) throw new DomainError('invalidParent');
  const parent = await get(db, parentId);
  if (!parent || parent.kind !== kind || parent.parent_id || parent.archived_at) {
    throw new DomainError('invalidParent');
  }
  if (selfId) {
    const child = await db.getOptional('SELECT 1 AS x FROM categories WHERE parent_id = ? LIMIT 1', [selfId]);
    if (child) throw new DomainError('hasSubcategories');
  }
}

export async function createCategory(db: Db, userId: string, input: CategoryInput): Promise<string> {
  const v = categoryInputSchema.parse(input);
  await checkParent(db, null, v.kind, v.parentId);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    `INSERT INTO categories (id, user_id, name, kind, parent_id, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, v.name, v.kind, v.parentId, v.color, v.icon, now, now],
  );
  return id;
}

/** Kind is fixed after creation: flipping it would silently turn past expenses into income. */
export async function updateCategory(db: Db, id: string, input: Omit<CategoryInput, 'kind'>): Promise<void> {
  const current = await get(db, id);
  if (!current) throw new DomainError('notFound');
  const v = categoryInputSchema.parse({ ...input, kind: current.kind });
  await checkParent(db, id, current.kind, v.parentId);
  await db.execute(
    // Renaming a built-in category drops its translation key so the user's own name is shown.
    `UPDATE categories SET key = CASE WHEN name = ? THEN key ELSE NULL END,
       name = ?, parent_id = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?`,
    [v.name, v.name, v.parentId, v.color, v.icon, nowIso(), id],
  );
}

/** Archiving hides a category (and its subcategories) from pickers; history keeps it. */
export async function setCategoryArchived(db: Db, id: string, archived: boolean): Promise<void> {
  const now = nowIso();
  if (archived) {
    await db.execute('UPDATE categories SET archived_at = ?, updated_at = ? WHERE id = ? OR parent_id = ?', [now, now, id, id]);
  } else {
    // Restore it, its subcategories, and its parent (a visible child needs a visible parent).
    await db.execute(
      `UPDATE categories SET archived_at = NULL, updated_at = ?
       WHERE id = ? OR parent_id = ? OR id = (SELECT parent_id FROM categories WHERE id = ?)`,
      [now, id, id, id],
    );
  }
}

/** Hard delete only when nothing references it; otherwise the caller should archive. */
export async function deleteCategory(db: Db, id: string): Promise<void> {
  const used = await db.getOptional(
    `SELECT 1 AS x FROM transactions WHERE category_id = ?
     UNION ALL SELECT 1 FROM categories WHERE parent_id = ? LIMIT 1`,
    [id, id],
  );
  if (used) throw new DomainError('categoryInUse');
  await db.execute('DELETE FROM budgets WHERE category_id = ?', [id]);
  await db.execute('DELETE FROM recurring WHERE category_id = ?', [id]);
  await db.execute('DELETE FROM categories WHERE id = ?', [id]);
}

/** Parents sorted by label, each followed by its children. Orphans (parent hidden) are shown as top-level. */
export function orderCategoryTree<T extends { id: string; parent_id: string | null }>(rows: T[], label: (r: T) => string) {
  const ids = new Set(rows.map((r) => r.id));
  const byLabel = (a: T, b: T) => label(a).localeCompare(label(b));
  const tops = rows.filter((r) => !r.parent_id || !ids.has(r.parent_id)).sort(byLabel);
  return tops.flatMap((p) => [
    { row: p, depth: 0 },
    ...rows.filter((c) => c.parent_id === p.id).sort(byLabel).map((row) => ({ row, depth: 1 })),
  ]);
}
