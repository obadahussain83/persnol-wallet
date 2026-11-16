import { z } from 'zod';

import { type Db, DomainError, newId, nowIso } from './db.ts';

export const CONTACT_KINDS = ['client', 'supplier'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

// Messages are i18n keys under `errors.`.
export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  kind: z.enum(CONTACT_KINDS),
  phone: z.string().trim().max(30, 'tooLong').regex(/^[+\d\s-]*$/, 'invalidPhone'),
  note: z.string().trim().max(500, 'tooLong'),
});
export type ContactInput = z.input<typeof contactInputSchema>;

export async function createContact(db: Db, userId: string, input: ContactInput): Promise<string> {
  const v = contactInputSchema.parse(input);
  const id = await newId(db);
  const now = nowIso();
  await db.execute(
    'INSERT INTO contacts (id, user_id, name, kind, phone, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, userId, v.name, v.kind, v.phone || null, v.note || null, now, now],
  );
  return id;
}

/** Renaming a contact also renames the person on its linked debts and cheques, so lists stay consistent. */
export async function updateContact(db: Db, id: string, input: ContactInput): Promise<void> {
  const v = contactInputSchema.parse(input);
  if (!(await db.getOptional('SELECT 1 AS x FROM contacts WHERE id = ?', [id]))) throw new DomainError('notFound');
  const now = nowIso();
  await db.execute('UPDATE contacts SET name = ?, kind = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?',
    [v.name, v.kind, v.phone || null, v.note || null, now, id]);
  await db.execute('UPDATE debts SET person = ?, updated_at = ? WHERE contact_id = ? AND person <> ?', [v.name, now, id, v.name]);
  await db.execute('UPDATE cheques SET person = ?, updated_at = ? WHERE contact_id = ? AND person <> ?', [v.name, now, id, v.name]);
}

/** Debts and cheques keep their person name and are just unlinked. */
export async function deleteContact(db: Db, id: string): Promise<void> {
  const now = nowIso();
  await db.execute('UPDATE debts SET contact_id = NULL, updated_at = ? WHERE contact_id = ?', [now, id]);
  await db.execute('UPDATE cheques SET contact_id = NULL, updated_at = ? WHERE contact_id = ?', [now, id]);
  await db.execute('DELETE FROM contacts WHERE id = ?', [id]);
}

export type ContactBalance = { currency: string; owed_to_me_minor: number; i_owe_minor: number };

/**
 * What is open with one contact, per currency: unpaid debt remainders plus pending cheques.
 * Received cheques count as owed to me (not cashed yet); written cheques as owed by me. Param: [contactId, contactId].
 */
export const CONTACT_BALANCE_SQL = `
SELECT currency, SUM(owed_to_me) AS owed_to_me_minor, SUM(i_owe) AS i_owe_minor FROM (
  SELECT d.currency,
    CASE WHEN d.direction = 'owed_to_me' THEN d.amount_minor - COALESCE((SELECT SUM(p.amount_minor) FROM debt_payments p WHERE p.debt_id = d.id), 0) ELSE 0 END AS owed_to_me,
    CASE WHEN d.direction = 'i_owe' THEN d.amount_minor - COALESCE((SELECT SUM(p.amount_minor) FROM debt_payments p WHERE p.debt_id = d.id), 0) ELSE 0 END AS i_owe
  FROM debts d WHERE d.contact_id = ? AND d.settled_at IS NULL
  UNION ALL
  SELECT c.currency,
    CASE WHEN c.direction = 'incoming' THEN c.amount_minor ELSE 0 END,
    CASE WHEN c.direction = 'outgoing' THEN c.amount_minor ELSE 0 END
  FROM cheques c WHERE c.contact_id = ? AND c.status = 'pending'
)
GROUP BY currency
ORDER BY currency`;
