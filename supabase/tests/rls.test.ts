/// <reference types="node" />
// Runs the real migration in PGlite (Postgres in WASM) with a minimal stand-in for Supabase's
// auth schema, then checks RLS isolation and the ledger constraints. No Docker needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated;
  `);
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  return db;
}

async function as(db: PGlite, user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local request.jwt.claim.sub = '${user}';`);
    return tx.query(sql, params);
  });
}

const insertAccount = `insert into accounts (id, name, type, currency) values ($1, $2, 'cash', 'ILS')`;
const insertTx = `insert into transactions (id, type, account_id, amount_minor, currency, occurred_at, to_account_id, to_amount_minor)
  values ($1, $2, $3, $4, 'ILS', now(), $5, $6)`;

test('RLS: users only see and modify their own rows', async () => {
  const db = await setup();
  await as(db, A, insertAccount, [id(1), 'A cash']);
  await as(db, B, insertAccount, [id(2), 'B cash']);

  const seenByB = await as(db, B, 'select id from accounts');
  assert.deepEqual(seenByB.rows, [{ id: id(2) }]);

  const upd = await as(db, B, `update accounts set name = 'hacked' where id = $1`, [id(1)]);
  assert.equal(upd.affectedRows, 0);
  const del = await as(db, B, `delete from accounts where id = $1`, [id(1)]);
  assert.equal(del.affectedRows, 0);

  const anon = await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated;');
    return tx.query('select id from accounts');
  });
  assert.equal(anon.rows.length, 0);
});

test('debts: private to their owner; direction and amount are constrained', async () => {
  const db = await setup();
  const insertDebt = `insert into debts (id, direction, person, amount_minor, currency) values ($1, $2, 'Ahmad', $3, 'ILS')`;
  await as(db, A, insertDebt, [id(1), 'owed_to_me', 5000]);
  await as(db, A, insertDebt, [id(2), 'i_owe', 100]);
  assert.equal((await as(db, B, 'select id from debts')).rows.length, 0);
  assert.equal((await as(db, B, `update debts set person = 'x' where id = $1`, [id(1)])).affectedRows, 0);
  assert.equal((await as(db, B, `delete from debts where id = $1`, [id(1)])).affectedRows, 0);
  await assert.rejects(as(db, A, insertDebt, [id(3), 'other', 100]));
  await assert.rejects(as(db, A, insertDebt, [id(4), 'i_owe', 0]));
});

test('server owns user_id: client cannot write rows as another user', async () => {
  const db = await setup();
  await as(db, B, `insert into accounts (id, user_id, name, type, currency) values ($1, $2, 'x', 'cash', 'ILS')`, [id(3), A]);
  const owner = await db.query<{ user_id: string }>('select user_id from accounts where id = $1', [id(3)]);
  assert.equal(owner.rows[0].user_id, B);
});

test("cannot post a transaction against another user's account", async () => {
  const db = await setup();
  await as(db, A, insertAccount, [id(1), 'A cash']);
  await assert.rejects(as(db, B, insertTx, [id(10), 'expense', id(1), 5000, null, null]));
});

test('ledger constraints: positive amounts, transfer shape, version bump, idempotent insert', async () => {
  const db = await setup();
  await as(db, A, insertAccount, [id(1), 'Cash']);
  await as(db, A, insertAccount, [id(2), 'Bank']);

  await assert.rejects(as(db, A, insertTx, [id(10), 'expense', id(1), 0, null, null]));
  await assert.rejects(as(db, A, insertTx, [id(11), 'transfer', id(1), 100, null, null]));
  await assert.rejects(as(db, A, insertTx, [id(12), 'transfer', id(1), 100, id(1), 100]));
  await assert.rejects(as(db, A, insertTx, [id(13), 'expense', id(1), 100, id(2), 100]));

  await as(db, A, insertTx, [id(14), 'transfer', id(1), 100, id(2), 100]);
  await as(db, A, `update transactions set notes = 'x' where id = $1`, [id(14)]);
  const v = await db.query<{ version: number }>('select version from transactions where id = $1', [id(14)]);
  assert.equal(v.rows[0].version, 2);

  // Retried upload of the same insert must not duplicate or clobber (ON CONFLICT DO NOTHING).
  await as(db, A, insertTx.replace(/\)\s*$/, ') on conflict (id) do nothing'), [id(14), 'transfer', id(1), 999, id(2), 999]);
  const rows = await db.query<{ amount_minor: string }>('select amount_minor from transactions');
  assert.deepEqual(rows.rows.map((r) => Number(r.amount_minor)), [100]);
});

test('signup seeds a profile and the default categories', async () => {
  const db = await setup();
  const cats = await as(db, A, `select kind, count(*)::int as n from categories group by kind order by kind`);
  assert.deepEqual(cats.rows, [{ kind: 'expense', n: 15 }, { kind: 'income', n: 6 }]);
  const prof = await as(db, A, 'select id, primary_currency from profiles');
  assert.deepEqual(prof.rows, [{ id: A, primary_currency: 'ILS' }]);
});

test('profiles: own row is editable; others are invisible; clients cannot create profiles', async () => {
  const db = await setup();
  const upd = await as(db, A, `update profiles set display_name = 'Sam', primary_currency = 'USD' where id = $1`, [A]);
  assert.equal(upd.affectedRows, 1);
  assert.equal((await as(db, B, 'select id from profiles where id = $1', [A])).rows.length, 0);
  assert.equal((await as(db, B, `update profiles set display_name = 'x' where id = $1`, [A])).affectedRows, 0);
  await assert.rejects(as(db, A, `insert into profiles (id, user_id) values ($1, $1)`, [B]));
});

test('transaction scope defaults to personal and only allows personal/work', async () => {
  const db = await setup();
  await as(db, A, insertAccount, [id(1), 'Cash']);
  await as(db, A, insertTx, [id(20), 'expense', id(1), 100, null, null]);
  const r = await db.query<{ scope: string }>('select scope from transactions where id = $1', [id(20)]);
  assert.equal(r.rows[0].scope, 'personal');
  await as(db, A, `update transactions set scope = 'work' where id = $1`, [id(20)]);
  await assert.rejects(as(db, A, `update transactions set scope = 'other' where id = $1`, [id(20)]));
});
