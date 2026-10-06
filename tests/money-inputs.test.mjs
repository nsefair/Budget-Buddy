import test from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToCents, isFutureDate } from '../src/features/money/input.ts';

test('currency input preserves exact cents and rejects ambiguous values', () => {
  assert.equal(dollarsToCents('0.29'), 29);
  assert.equal(dollarsToCents('1400'), 140000);
  assert.equal(dollarsToCents('0'), 0);
  for (const input of ['', '1,400', '-2', '1.001', '1e3', 'NaN', '100000001']) {
    assert.equal(dollarsToCents(input), null, input);
  }
});
test('arrival validates real calendar dates and rejects passed or distant paydays', () => {
  assert.equal(isFutureDate('2026-10-16', '2026-10-04'), true);
  assert.equal(isFutureDate('2028-02-29', '2028-02-28'), true);
  for (const input of ['2026-02-29', '2026-10-04', '2026-10-03', '2026-10-32', '2028-10-04', '10/16/2026']) {
    assert.equal(isFutureDate(input, '2026-10-04'), false, input);
  }
});
