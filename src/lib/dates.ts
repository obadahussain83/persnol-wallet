/** [start, end) of the calendar month containing `d`, in the device's local time, as ISO strings. */
export function monthRange(d = new Date()): [string, string] {
  return [new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()];
}

/** Local calendar day key (YYYY-MM-DD) used to group transactions. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
