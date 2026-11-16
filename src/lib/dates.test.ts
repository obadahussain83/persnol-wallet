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
