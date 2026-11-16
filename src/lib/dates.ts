/** [start, end) of the calendar month containing `d`, in the device's local time, as ISO strings. */
export function monthRange(d = new Date()): [string, string] {
  return [new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()];
}

/** Local calendar day key (YYYY-MM-DD) used to group transactions. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local midnight for a YYYY-MM-DD string (Arabic-Indic digits allowed), or null if it isn't a real date. */
export function parseDay(input: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim().replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

/** [from, to) ISO range covering whole local days. Empty `to` means just the `from` day. Null if invalid or reversed. */
export function dayRange(from: string, to: string): [string, string] | null {
  const a = parseDay(from);
  const b = to.trim() ? parseDay(to) : a;
  if (!a || !b || b < a) return null;
  return [a.toISOString(), new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1).toISOString()];
}
