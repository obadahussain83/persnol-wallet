import { column, Schema, Table } from '@powersync/common';

// Local (client) schema. Mirrors supabase/migrations. PowerSync adds the `id` text column itself.
// Amounts are integer minor units; timestamps are ISO-8601 text.

const accounts = new Table(
  {
    user_id: column.text,
    name: column.text,
    type: column.text, // cash | bank | wallet | savings | other
    currency: column.text,
    opening_balance_minor: column.integer,
    description: column.text,
    color: column.text,
    icon: column.text,
    archived_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

const categories = new Table(
  {
    user_id: column.text,
    key: column.text, // built-in category id for translation; null for user-created
    name: column.text,
    kind: column.text, // income | expense
    parent_id: column.text,
    color: column.text,
    icon: column.text,
    archived_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

// One row per financial event. A transfer is ONE row (account_id -> to_account_id),
// so it is atomic on every device and in every upload by construction.
const transactions = new Table(
  {
    user_id: column.text,
    type: column.text, // income | expense | transfer
    account_id: column.text,
    amount_minor: column.integer, // always positive, in `currency`
    currency: column.text,
    to_account_id: column.text, // transfer only
    to_amount_minor: column.integer, // transfer only, in destination account currency
    exchange_rate: column.text, // decimal string, frozen at entry time
    category_id: column.text,
    occurred_at: column.text,
    description: column.text,
    merchant: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    scope: column.text, // personal | work (transfers: personal)
    version: column.integer, // server-assigned revision, used for conflict detection
  },
  { indexes: { by_account: ['account_id'], by_date: ['occurred_at'] } },
);

// Created server-side at signup (id = user id). Clients only update it.
const profiles = new Table({
  user_id: column.text,
  display_name: column.text,
  primary_currency: column.text,
  created_at: column.text,
  updated_at: column.text,
  version: column.integer,
});

// Standalone record of money owed; it does not touch account balances.
const debts = new Table(
  {
    user_id: column.text,
    direction: column.text, // owed_to_me | i_owe
    person: column.text,
    amount_minor: column.integer, // always positive, in `currency`
    currency: column.text,
    note: column.text,
    settled_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

export const AppSchema = new Schema({ accounts, categories, transactions, profiles, debts });
export type Database = (typeof AppSchema)['types'];
export type AccountRow = Database['accounts'];
export type CategoryRow = Database['categories'];
export type TransactionRow = Database['transactions'];
export type ProfileRow = Database['profiles'];
