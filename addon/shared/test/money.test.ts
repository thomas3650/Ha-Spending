import { describe, expect, it } from "vitest";
import {
  byUnit,
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
import { unitsOf } from "../src/units";
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

  it("gives the total and the average of the whole units", () => {
    expect(keyNumbers(all, T)).toEqual({
      total: 1043500,
      average: { amount: 513750, units: 2, basis: "period" },
    });
  });

  it("averages the 12 units before a one-unit period, counting units with data", () => {
    const march = keyNumbers(all, { ...T, period: { start: "2026-03-01", end: "2026-03-18" } });
    expect(march.average).toEqual({ amount: 512500, units: 3, basis: "before" });

    const febMarch = keyNumbers(all, { ...T, period: { start: "2026-02-01", end: "2026-03-18" } });
    expect(febMarch.average).toEqual({ amount: 516500, units: 2, basis: "before" });
  });

  it("leaves out units before the data", () => {
    const dec = keyNumbers(all, { ...T, period: { start: "2025-12-01", end: "2025-12-31" } });
    expect(dec.total).toBe(510000);
    expect(dec.average).toEqual({ amount: null, units: 0, basis: "before" });
  });

  it("copes with no postings and no data", () => {
    const empty = keyNumbers([], { ...T, earliest: null });
    expect(empty.total).toBe(0);
    expect(empty.average.amount).toBeNull();
  });

  it("counts a clipped unit as whole in the average", () => {
    const t = { ...T, period: { start: "2026-01-15", end: "2026-02-28" } };
    expect(keyNumbers(all, t)).toEqual({
      total: 1002500,
      average: { amount: 501250, units: 2, basis: "period" },
    });
  });

  it("gives a chosen unit's amount and the average of the other whole units", () => {
    expect(chosenUnitNumbers(all, T, jan)).toEqual({
      amount: 523000,
      average: { amount: 504500, units: 1, basis: "period" },
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

  it("splits postings per unit, adding up to the bars", () => {
    const units = unitsOf(T.period, "month", T.today);
    const groups = byUnit(all, units);
    expect(groups.map((g) => g.unit)).toEqual(units);
    expect(groups.map((g) => g.total)).toEqual(unitTotals(all, units));
    expect(groups.map((g) => g.total)).toEqual([523000, 504500, 16000]);
    expect(groups.map((g) => g.postings.map((p) => p.id))).toEqual([
      ["p3", "p4", "p5", "p6"],
      ["p7", "p8", "p9"],
      ["p10", "p11"],
    ]);
  });
});
