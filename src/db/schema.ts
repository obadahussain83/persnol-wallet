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
    due_date: column.text, // YYYY-MM-DD, optional
    phone: column.text, // optional, for WhatsApp reminders
    contact_id: column.text, // optional link to a client/supplier
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

// Monthly spending limit for one expense category in one currency (subcategories count toward a parent's budget).
const budgets = new Table(
  {
    user_id: column.text,
    category_id: column.text,
    amount_minor: column.integer, // always positive, in `currency`
    currency: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

// A repeating income/expense. Due occurrences become ordinary transactions (see src/data/recurring.ts).
const recurring = new Table(
  {
    user_id: column.text,
    type: column.text, // income | expense
    account_id: column.text,
    category_id: column.text,
    amount_minor: column.integer, // always positive, in `currency` (the account's)
    currency: column.text,
    scope: column.text, // personal | work
    note: column.text,
    frequency: column.text, // weekly | monthly | yearly
    start_date: column.text, // YYYY-MM-DD, local calendar day of the first occurrence
    paused_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

// Post-dated cheque, received or written. Standalone like a debt: it does not touch balances by itself.
const cheques = new Table(
  {
    user_id: column.text,
    direction: column.text, // incoming | outgoing
    person: column.text,
    amount_minor: column.integer, // always positive, in `currency`
    currency: column.text,
    bank: column.text,
    number: column.text,
    due_date: column.text, // YYYY-MM-DD
    status: column.text, // pending | cleared | bounced
    status_at: column.text,
    note: column.text,
    contact_id: column.text, // optional link to a client/supplier
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'], by_due: ['due_date'] } },
);

// A partial (or full) repayment of a debt. Remaining = debt amount − sum of its payments.
const debt_payments = new Table(
  {
    user_id: column.text,
    debt_id: column.text,
    amount_minor: column.integer, // always positive, in the debt's currency
    paid_at: column.text,
    note: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_debt: ['debt_id'] } },
);

// Exchange rates, kept on this device only (never synced). The id is the currency code.
// Automatic row: per_usd = units of `code` for 1 USD. Manual row (manual = 1, typed by the user, never overwritten):
// per_usd holds "1 `code` = per_usd `base`", so it stays pinned to what was typed when other rates move.
const fx_rates = new Table(
  {
    per_usd: column.text,
    base: column.text,
    fetched_at: column.text,
    manual: column.integer,
  },
  { localOnly: true },
);

// A client or supplier. Debts and cheques may link to one (contact_id) to build a per-contact statement.
const contacts = new Table(
  {
    user_id: column.text,
    name: column.text,
    kind: column.text, // client | supplier
    phone: column.text,
    note: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

// Invoice or quote. `items` is JSON text: [{ description, quantity (decimal string), unit_price_minor }].
const invoices = new Table(
  {
    user_id: column.text,
    kind: column.text, // invoice | quote
    number: column.text, // e.g. INV-0007 / QUO-0003
    contact_id: column.text,
    client_name: column.text,
    currency: column.text,
    issue_date: column.text, // YYYY-MM-DD
    due_date: column.text,
    items: column.text,
    total_minor: column.integer, // derived from items, stored for lists and reports
    note: column.text,
    status: column.text, // draft | sent | paid | cancelled
    status_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    version: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

export const AppSchema = new Schema({
  accounts, categories, transactions, profiles, debts, budgets, recurring, cheques, debt_payments, fx_rates, contacts, invoices,
});
export type Database = (typeof AppSchema)['types'];
export type AccountRow = Database['accounts'];
export type CategoryRow = Database['categories'];
export type TransactionRow = Database['transactions'];
export type ProfileRow = Database['profiles'];
