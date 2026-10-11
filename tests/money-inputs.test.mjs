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
test('cycle breakdown adds back up to income and reports overspend exactly', async () => {
  const { cycleBreakdown } = await import('../src/features/money/breakdown.ts');
  const result = (spentBeforeTodayCents, spentTodayCents, allocatedGoalCents = 1_000) => {
    const cycle = { incomeCents: 380_000, billsCents: 120_000, plannedGoalCents: 20_000 };
    const bufferCents = 38_000;
    const flexibleBalanceCents = cycle.incomeCents - cycle.billsCents - cycle.plannedGoalCents
      - bufferCents - allocatedGoalCents - spentBeforeTodayCents;
    return { inputs: { cycle, spentBeforeTodayCents, spentTodayCents, allocatedGoalCents }, bufferCents, flexibleBalanceCents };
  };
  const cents = (breakdown) => Object.fromEntries(breakdown.parts.map((part) => [part.key, part.cents]));

  const normal = cycleBreakdown(result(50_000, 2_500));
  assert.deepEqual(cents(normal), { bills: 120_000, goals: 21_000, buffer: 38_000, spent: 52_500, left: 148_500 });
  assert.equal(normal.totalCents, 380_000);
  assert.equal(normal.overCents, 0);

  // A refund today adds back to what is left; the parts still equal income.
  const refund = cycleBreakdown(result(50_000, -1_500));
  assert.equal(cents(refund).spent, 48_500);
  assert.equal(refund.totalCents, 380_000);

  // Spending past the flexible money: nothing left, and the overspend is exact.
  const over = cycleBreakdown(result(195_000, 8_000));
  assert.equal(cents(over).left, 0);
  assert.equal(over.overCents, 2_000);
  assert.equal(over.totalCents, 382_000);
});
test('compact currency steps up to millions and billions without "1000K"', async () => {
  const { formatCurrency } = await import('../src/utils/security.ts');
  const compact = (value) => formatCurrency(value, { compact: true });
  assert.equal(compact(999), '$999');
  assert.equal(compact(1234), '$1.2K');
  assert.equal(compact(9999), '$10K');
  assert.equal(compact(15898), '$16K');
  assert.equal(compact(999_600), '$1.0M');
  assert.equal(compact(2_676_000), '$2.7M');
  assert.equal(compact(48_200_000), '$48M');
  assert.equal(compact(1_250_000_000), '$1.3B');
  assert.equal(compact(-21_050), '−$21K');
});
