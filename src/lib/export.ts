// Excel export of everything the user has recorded: one workbook, one sheet per kind of record.
import type { Db } from '../data/db.ts';
import { ALL_ACCOUNT_BALANCES_SQL, type AccountBalance, TRANSACTIONS_LIST_SQL, type TransactionListRow } from '../db/queries.ts';
import { toDecimalString } from './money.ts';

export type DebtExportRow = {
  direction: 'owed_to_me' | 'i_owe'; person: string; amount_minor: number; currency: string;
  note: string | null; settled_at: string | null; created_at: string;
};
export const DEBTS_EXPORT_SQL = `
SELECT direction, person, amount_minor, currency, note, settled_at, created_at
FROM debts ORDER BY created_at DESC`;

export type ExportData = { transactions: TransactionListRow[]; accounts: AccountBalance[]; debts: DebtExportRow[] };
export type Sheet = { name: string; rows: (string | number)[][] };
type T = (key: string) => string;
type LabelOf = (c: { key: string | null; name: string | null }) => string;

/** Local calendar date, so a late-evening transaction lands on the day the user saw it. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A real number cell, so Excel can sum and sort the column. Display-only conversion, like formatMoney.
const amount = (minor: number, currency: string) => Number(toDecimalString(minor, currency));

/** Turns the user's records into sheet rows. `labelOf` resolves a category's display name. */
export function buildSheets(data: ExportData, t: T, labelOf: LabelOf): Sheet[] {
  const transactions: Sheet = {
    name: t('tx.title'),
    rows: [
      [t('tx.date'), t('export.type'), t('export.scope'), t('tx.category'), t('tx.account'), t('tx.to'),
        t('tx.amount'), t('accounts.currency'), t('export.received'), t('export.receivedCurrency'), t('tx.note')],
      ...data.transactions.map((tx) => {
        // Signed like the app shows it: spending is negative, so a column sum is the net.
        const minor = tx.type === 'expense' ? -tx.amount_minor : tx.amount_minor;
        const transfer = tx.type === 'transfer';
        return [
          localDay(tx.occurred_at), t(`tx.${tx.type}`), transfer ? '' : t(`tx.${tx.scope ?? 'personal'}`),
          transfer ? '' : labelOf({ key: tx.category_key, name: tx.category_name }), tx.account_name, tx.to_account_name ?? '',
          amount(minor, tx.currency), tx.currency,
          transfer && tx.to_amount_minor != null && tx.to_currency ? amount(tx.to_amount_minor, tx.to_currency) : '',
          transfer ? (tx.to_currency ?? '') : '', tx.notes ?? '',
        ];
      }),
    ],
  };
  const accounts: Sheet = {
    name: t('accounts.title'),
    rows: [
      [t('accounts.name'), t('export.type'), t('accounts.currency'), t('export.balance'), t('export.status')],
      ...data.accounts.map((a) => [
        a.name, t(`accountTypes.${a.type}`), a.currency, amount(a.balance_minor, a.currency), a.archived_at ? t('common.archived') : '',
      ]),
    ],
  };
  const debts: Sheet = {
    name: t('debts.title'),
    rows: [
      [t('tx.date'), t('export.type'), t('debts.person'), t('tx.amount'), t('accounts.currency'), t('export.status'), t('tx.note')],
      ...data.debts.map((d) => [
        localDay(d.created_at), t(d.direction === 'owed_to_me' ? 'debts.owedToMe' : 'debts.iOwe'), d.person,
        amount(d.amount_minor, d.currency), d.currency, t(d.settled_at ? 'debts.settled' : 'debts.outstanding'), d.note ?? '',
      ]),
    ],
  };
  return [transactions, accounts, debts];
}

/** Reads every record from the local database and downloads it as an .xlsx file. Returns the file name. */
export async function exportToExcel(db: Db, t: T, labelOf: LabelOf, rtl: boolean): Promise<string> {
  const [transactions, accounts, debts] = await Promise.all([
    db.getAll<TransactionListRow>(TRANSACTIONS_LIST_SQL, [-1]), // SQLite: LIMIT -1 means no limit
    db.getAll<AccountBalance>(ALL_ACCOUNT_BALANCES_SQL),
    db.getAll<DebtExportRow>(DEBTS_EXPORT_SQL),
  ]);
  // Loaded on demand: SheetJS is large and only this button needs it.
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();
  for (const sheet of buildSheets({ transactions, accounts, debts }, t, labelOf)) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = sheet.rows[0].map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(book, ws, sheet.name);
  }
  if (rtl) book.Workbook = { Views: [{ RTL: true }] }; // sheets open right-to-left for Arabic
  const file = `personal-wallet-${localDay(new Date().toISOString())}.xlsx`;
  XLSX.writeFile(book, file); // in a browser this triggers the download
  return file;
}
