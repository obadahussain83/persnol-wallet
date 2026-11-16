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

/** ISO timestamp `days` days before now. */
export function daysAgoIso(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** This month from its 1st up to now, and the same stretch of last month (clamped to last month's end). */
export function monthToDateRanges(now = new Date()): { current: [string, string]; previous: [string, string] } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Same calendar day and clock time last month (not elapsed ms, which drifts across a DST change).
  const sameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  const prevEnd = sameDay.getMonth() === prevStart.getMonth() ? sameDay : start; // e.g. March 31 → all of February
  return { current: [start.toISOString(), now.toISOString()], previous: [prevStart.toISOString(), prevEnd.toISOString()] };
}
