// Where a cycle's income goes, from the money engine's own numbers only.
// The engine defines flexible = income − bills − planned goal − buffer −
// moved to goals − spent before today, so these parts add back up to income
// exactly. Nothing here estimates, rounds, or invents money.

export type BreakdownInput = {
  inputs: {
    cycle: { incomeCents: number; billsCents: number; plannedGoalCents: number };
    spentBeforeTodayCents: number;
    spentTodayCents: number;
    allocatedGoalCents: number;
  };
  bufferCents: number;
  flexibleBalanceCents: number;
};

export type BreakdownPart = {
  key: "bills" | "goals" | "buffer" | "spent" | "left";
  cents: number;
};

export function cycleBreakdown(result: BreakdownInput) {
  const { cycle, spentBeforeTodayCents, spentTodayCents, allocatedGoalCents } = result.inputs;
  // Today's purchases come out of the flexible money; refunds add back.
  const left = result.flexibleBalanceCents - spentTodayCents;
  const parts: BreakdownPart[] = [
    { key: "bills", cents: cycle.billsCents },
    { key: "goals", cents: cycle.plannedGoalCents + allocatedGoalCents },
    { key: "buffer", cents: result.bufferCents },
    { key: "spent", cents: Math.max(0, spentBeforeTodayCents + spentTodayCents) },
    { key: "left", cents: Math.max(0, left) },
  ];
  return {
    incomeCents: cycle.incomeCents,
    parts,
    // Equals income, or more once spending passes this cycle's flexible money.
    totalCents: parts.reduce((sum, part) => sum + part.cents, 0),
    overCents: Math.max(0, -left),
  };
}
