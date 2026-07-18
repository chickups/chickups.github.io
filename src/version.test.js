// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION, BUILD_DATE } from './version.js';

test('APP_VERSION is a vN string (matches the sw cache suffix shape)', () => {
  assert.match(APP_VERSION, /^v\d+$/);
});

test('BUILD_DATE is an ISO calendar date', () => {
  assert.match(BUILD_DATE, /^\d{4}-\d{2}-\d{2}$/);
  // Parses to a real date (kills a typo like 2026-13-40).
  const [y, m, d] = BUILD_DATE.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  assert.equal(dt.getUTCFullYear(), y);
  assert.equal(dt.getUTCMonth(), m - 1);
  assert.equal(dt.getUTCDate(), d);
});
