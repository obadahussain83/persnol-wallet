/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, formatMoney, parseAmount, sumMinor, toDecimalString } from './money.ts';

test('parseAmount uses currency precision', () => {
  assert.equal(parseAmount('50', 'ILS'), 5000);
  assert.equal(parseAmount('12.5', 'USD'), 1250);
  assert.equal(parseAmount('1.234', 'JOD'), 1234);
  assert.equal(parseAmount('0,10', 'ILS'), 10);
  assert.equal(parseAmount('-0.125', 'JOD'), -125);
  assert.equal(parseAmount('-0', 'ILS'), 0);
});

test('parseAmount rejects bad input and excess precision', () => {
  assert.throws(() => parseAmount('1.234', 'USD'));
  assert.throws(() => parseAmount('abc', 'USD'));
  assert.throws(() => parseAmount('1e3', 'USD'));
  assert.throws(() => parseAmount('5', 'XXX'));
  assert.throws(() => parseAmount('99999999999999999', 'USD'));
});

test('no float drift: 0.1 + 0.2', () => {
  assert.equal(sumMinor([parseAmount('0.1', 'USD'), parseAmount('0.2', 'USD')]), parseAmount('0.3', 'USD'));
});

test('toDecimalString round-trips', () => {
  assert.equal(toDecimalString(12345, 'JOD'), '12.345');
  assert.equal(toDecimalString(5, 'ILS'), '0.05');
  assert.equal(toDecimalString(-5, 'ILS'), '-0.05');
});

test('convert is exact and rounds half away from zero', () => {
  assert.equal(convert(10000, 'USD', 'ILS', '3.65'), 36500); // 100 USD -> 365 ILS
  assert.equal(convert(1000, 'JOD', 'USD', '1.41'), 141); // 1.000 JOD -> 1.41 USD
  assert.equal(convert(1, 'USD', 'ILS', '0.5'), 1); // 0.005 -> 0.01
  assert.equal(convert(-1, 'USD', 'ILS', '0.5'), -1);
  assert.equal(convert(100, 'ILS', 'JOD', '0.19'), 190); // 1 ILS -> 0.190 JOD
});

test('formatMoney respects decimals', () => {
  assert.equal(formatMoney(123456, 'USD', 'en-US'), '$1,234.56');
  assert.match(formatMoney(1234, 'JOD', 'en-US'), /1\.234/);
});

test('parseAmount accepts Arabic-Indic digits and separators', () => {
  assert.equal(parseAmount('١٢٫٥', 'ILS'), 1250);
  assert.equal(parseAmount('١٬٢٥٠٫٥٠٠', 'JOD'), 1250500);
  assert.equal(parseAmount('۳۵', 'USD'), 3500);
});
