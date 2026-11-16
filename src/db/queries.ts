// Single source of truth for balance math: balances are always derived from the ledger,
// never stored. Transfers move money between accounts and are excluded from income/expense.

const accountBalancesSql = (where: string) => `
SELECT a.id, a.name, a.type, a.currency, a.icon, a.color, a.archived_at,
  a.opening_balance_minor + COALESCE(SUM(
    CASE
      WHEN t.type = 'income'   AND t.account_id    = a.id THEN  t.amount_minor
      WHEN t.type = 'expense'  AND t.account_id    = a.id THEN -t.amount_minor
      WHEN t.type = 'transfer' AND t.account_id    = a.id THEN -t.amount_minor
      WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN  t.to_amount_minor
    END), 0) AS balance_minor
FROM accounts a
LEFT JOIN transactions t
  ON (t.account_id = a.id OR t.to_account_id = a.id) AND t.deleted_at IS NULL
${where}
GROUP BY a.id
ORDER BY a.archived_at IS NOT NULL, a.name`;

export type AccountBalance = {
  id: string; name: string; type: string; currency: string; icon: string | null; color: string | null;
  archived_at: string | null; balance_minor: number;
};

/** Active accounts with balances. */
export const ACCOUNT_BALANCES_SQL = accountBalancesSql('WHERE a.archived_at IS NULL');
/** Active and archived accounts with balances (archived last). */
export const ALL_ACCOUNT_BALANCES_SQL = accountBalancesSql('');

/** Income/expense totals for a period, per currency. Params: [fromIso, toIso). */
export const PERIOD_TOTALS_SQL = `
SELECT currency,
  COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_minor END), 0) AS income_minor,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS expense_minor
FROM transactions
WHERE deleted_at IS NULL AND occurred_at >= ? AND occurred_at < ?
GROUP BY currency`;

export type TransactionListRow = {
  id: string; type: 'expense' | 'income' | 'transfer'; scope: 'personal' | 'work'; amount_minor: number; currency: string;
  to_amount_minor: number | null; to_currency: string | null; occurred_at: string; notes: string | null;
  account_name: string; to_account_name: string | null;
  category_key: string | null; category_name: string | null; category_icon: string | null; category_color: string | null;
};

/** Newest first. Param: [limit]. */
export const TRANSACTIONS_LIST_SQL = `
SELECT t.id, t.type, t.scope, t.amount_minor, t.currency, t.to_amount_minor, ta.currency AS to_currency, t.occurred_at, t.notes,
  a.name AS account_name, ta.name AS to_account_name,
  c.key AS category_key, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN accounts ta ON ta.id = t.to_account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.deleted_at IS NULL
ORDER BY t.occurred_at DESC, t.created_at DESC
LIMIT ?`;

/** Income/expense per currency and scope (personal | work) for a period. Params: [fromIso, toIso). Transfers excluded. */
export const SCOPE_TOTALS_SQL = `
SELECT currency, COALESCE(scope, 'personal') AS scope,
  COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_minor END), 0) AS income_minor,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS expense_minor
FROM transactions
WHERE deleted_at IS NULL AND type IN ('income', 'expense') AND occurred_at >= ? AND occurred_at < ?
GROUP BY currency, COALESCE(scope, 'personal')
ORDER BY currency, scope`;

export type OutstandingDebt = {
  direction: 'owed_to_me' | 'i_owe';
  currency: string;
  amount_minor: number;
};

/** Outstanding debt totals per direction and currency. */
export const OUTSTANDING_DEBTS_SQL = `
SELECT direction, currency, SUM(amount_minor) AS amount_minor
FROM debts
WHERE settled_at IS NULL
GROUP BY direction, currency
ORDER BY direction, currency`;
