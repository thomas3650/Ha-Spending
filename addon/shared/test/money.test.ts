import { describe, expect, it } from "vitest";
import {
  chosenUnitNumbers,
  classify,
  differences,
  keyNumbers,
  parts,
  select,
  share,
  total,
  unitTotals,
  within,
} from "../src/money";
import { type Timeline, unitsOf } from "../src/units";
import { categories, postings, T } from "./fixture";

const all = classify(postings, categories);
const [jan] = unitsOf(T.period, T.grouping, T.today);

describe("money", () => {
  it("nets refunds and adds up on every level", () => {
    const inP = within(all, T.period);
    expect(total(inP)).toBe(1043500);
    expect(parts(inP, { kind: "all" })).toEqual([
      { key: "Bolig", amount: 1000000 },
      { key: "Mad", amount: 39000 },
      { key: null, amount: 4500 },
    ]);
    expect(parts(inP, { kind: "mainGroup", mainGroup: "Mad" })).toEqual([
      { key: "Café", amount: 9000 },
      { key: "Dagligvarer", amount: 30000 },
    ]);
    expect(parts(inP, { kind: "mainGroup", mainGroup: null })).toEqual([
      { key: "Gaver", amount: 3000 },
      { key: null, amount: 1500 },
    ]);
    for (const p of parts(inP, { kind: "all" })) {
      const level = { kind: "mainGroup", mainGroup: p.key } as const;
      expect(parts(select(inP, level, null), level).reduce((s, x) => s + x.amount, 0)).toBe(p.amount);
    }
  });

  it("puts an unknown category and no category in Uden hovedgruppe", () => {
    const [unknown, none] = classify(
      [
        { ...postings[0], category: "Ukendt" },
        { ...postings[0], category: null },
      ],
      categories,
    );
    expect(unknown.mainGroup).toBeNull();
    expect(none.mainGroup).toBeNull();
  });

  it("filters by account", () => {
    expect(total(select(within(all, T.period), { kind: "all" }, new Set(["B"])))).toBe(12000);
  });

  it("selects a category inside its main group", () => {
    const level = { kind: "category", mainGroup: "Mad", category: "Café" } as const;
    expect(total(select(within(all, T.period), level, null))).toBe(9000);
    expect(parts(within(all, T.period), level)).toEqual([]);
  });

  it("gives shares as fractions", () => {
    expect(share(39000, 1043500)).toBeCloseTo(0.03737, 5);
    expect(share(1, 0)).toBeNull();
    expect(share(1, -5)).toBeNull();
  });

  it("sums per unit, the partial one too", () => {
    expect(unitTotals(all, unitsOf(T.period, "month", T.today))).toEqual([523000, 504500, 16000]);
  });

  it("averages the whole units and compares the last with the one before", () => {
    expect(keyNumbers(all, T)).toEqual({
      total: 1043500,
      average: { amount: 513750, units: 2, basis: "period" },
      comparison: {
        unit: expect.objectContaining({ fullStart: "2026-02-01" }),
        amount: 504500,
        before: expect.objectContaining({ fullStart: "2026-01-01" }),
        beforeAmount: 523000,
      },
    });
  });

  it("averages the 12 units before a one-unit period, counting units with data", () => {
    const march = keyNumbers(all, { ...T, period: { start: "2026-03-01", end: "2026-03-18" } });
    expect(march.average).toEqual({ amount: 512500, units: 3, basis: "before" });
    expect(march.comparison).toMatchObject({
      unit: { fullStart: "2026-03-01" },
      amount: 16000,
      before: { fullStart: "2026-02-01" },
      beforeAmount: 504500,
    });

    const febMarch = keyNumbers(all, { ...T, period: { start: "2026-02-01", end: "2026-03-18" } });
    expect(febMarch.average).toEqual({ amount: 516500, units: 2, basis: "before" });
    expect(febMarch.comparison).toMatchObject({
      unit: { fullStart: "2026-02-01" },
      amount: 504500,
      before: { fullStart: "2026-01-01" },
      beforeAmount: 523000,
    });
  });

  it("leaves out units before the data", () => {
    const dec = keyNumbers(all, { ...T, period: { start: "2025-12-01", end: "2025-12-31" } });
    expect(dec.total).toBe(510000);
    expect(dec.average).toEqual({ amount: null, units: 0, basis: "before" });
    expect(dec.comparison?.beforeAmount).toBeNull();
  });

  it("copes with no postings and no data", () => {
    const empty = keyNumbers([], { ...T, earliest: null });
    expect(empty.total).toBe(0);
    expect(empty.average.amount).toBeNull();
    expect(empty.comparison?.beforeAmount).toBeNull();
  });

  it("counts a clipped unit as whole in the average and the comparison", () => {
    const t = { ...T, period: { start: "2026-01-15", end: "2026-02-28" } };
    expect(keyNumbers(all, t)).toEqual({
      total: 1002500,
      average: { amount: 501250, units: 2, basis: "period" },
      comparison: {
        unit: expect.objectContaining({ fullStart: "2026-02-01" }),
        amount: 504500,
        before: expect.objectContaining({ start: "2026-01-15", fullStart: "2026-01-01" }),
        beforeAmount: 498000,
      },
    });
  });

  it("compares with the clipped unit before when it lies inside the period", () => {
    const t: Timeline = {
      period: { start: "2026-01-01", end: "2026-10-30" },
      grouping: "week",
      today: "2026-10-30",
      earliest: "2025-12-30",
    };
    const weekly = classify(
      [
        { ...postings[0], id: "w1", date: "2025-12-30", amount: 1000 },
        { ...postings[0], id: "w2", date: "2026-01-02", amount: 2000 },
        { ...postings[0], id: "w3", date: "2026-01-06", amount: 4000 },
      ],
      categories,
    );
    const week2 = unitsOf(t.period, t.grouping, t.today)[1];
    const numbers = chosenUnitNumbers(weekly, t, week2);
    expect(numbers.amount).toBe(4000);
    expect(numbers.before).toMatchObject({ start: "2026-01-01", end: "2026-01-04", clipped: true });
    expect(numbers.beforeAmount).toBe(2000);
    const [week1] = unitsOf(t.period, t.grouping, t.today);
    expect(chosenUnitNumbers(weekly, t, week1).before).toMatchObject({ start: "2025-12-22", end: "2025-12-28" });
  });

  it("compares a chosen unit with the other whole units and the one before", () => {
    expect(chosenUnitNumbers(all, T, jan)).toEqual({
      amount: 523000,
      average: { amount: 504500, units: 1, basis: "period" },
      before: expect.objectContaining({ fullStart: "2025-12-01" }),
      beforeAmount: 510000,
    });
  });

  it("lists the differences per part, largest first", () => {
    expect(differences(all, { kind: "all" }, T, jan)).toEqual([
      { key: "Mad", amount: 23000, average: 0, difference: 23000 },
      { key: null, amount: 0, average: 4500, difference: -4500 },
      { key: "Bolig", amount: 500000, average: 500000, difference: 0 },
    ]);
  });

  it("puts the differences without an average last", () => {
    const dec = { ...T, period: { start: "2025-12-01", end: "2025-12-31" } };
    const [unit] = unitsOf(dec.period, dec.grouping, dec.today);
    expect(differences(all, { kind: "all" }, dec, unit)).toEqual([
      { key: "Bolig", amount: 500000, average: null, difference: null },
      { key: "Mad", amount: 10000, average: null, difference: null },
    ]);
  });
});
