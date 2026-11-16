/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayRange, parseDay } from './dates.ts';

test('parseDay accepts real dates only, including Arabic-Indic digits', () => {
  assert.deepEqual(parseDay('2026-11-05'), new Date(2026, 10, 5));
  assert.deepEqual(parseDay('٢٠٢٦-١١-٠٥'), new Date(2026, 10, 5));
  for (const bad of ['', '2026-02-30', '05-11-2026', '2026/11/05']) assert.equal(parseDay(bad), null);
});

test('dayRange: single day, inclusive range, reversed/invalid', () => {
  assert.deepEqual(dayRange('2026-11-05', ''), [new Date(2026, 10, 5).toISOString(), new Date(2026, 10, 6).toISOString()]);
  assert.deepEqual(dayRange('2026-11-05', '2026-11-30'), [new Date(2026, 10, 5).toISOString(), new Date(2026, 11, 1).toISOString()]);
  assert.equal(dayRange('2026-11-30', '2026-11-05'), null);
  assert.equal(dayRange('', ''), null);
});

test('monthToDateRanges compares the same stretch of last month, clamped to its end', async () => {
  const { monthToDateRanges } = await import('./dates.ts');
  const r = monthToDateRanges(new Date(2026, 10, 16, 12));
  assert.deepEqual(r.current, [new Date(2026, 10, 1).toISOString(), new Date(2026, 10, 16, 12).toISOString()]);
  assert.deepEqual(r.previous, [new Date(2026, 9, 1).toISOString(), new Date(2026, 9, 16, 12).toISOString()]);
  const end = monthToDateRanges(new Date(2026, 2, 31, 12)); // March 31 → all of February
  assert.equal(end.previous[1], new Date(2026, 2, 1).toISOString());
});
