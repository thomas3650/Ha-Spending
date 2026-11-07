import { describe, expect, it } from "vitest";
import {
  byUnit,
  chosenUnitNumbers,
  classify,
  keyNumbers,
  paidPerMonth,
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

describe("paidPerMonth", () => {
  const payment = (date: string, amount = 10000) => ({ date, amount });
  const tl = (start: string, end: string, today: string, earliest: string | null = "2025-01-01") => ({
    period: { start, end },
    today,
    earliest,
  });
  const monthly = (months: number[]) => months.map((m) => payment(`2026-${String(m).padStart(2, "0")}-02`));

  it("leaves the running month's payments out", () => {
    const items = [...monthly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), payment("2026-11-02", 990000)];
    expect(paidPerMonth(items, tl("2026-01-01", "2026-11-07", "2026-11-07"))).toEqual({
      amount: 10000,
      months: 10,
      count: 10,
    });
  });

  it("counts a past month cut by the period's start", () => {
    const items = [payment("2026-01-20", 30000), payment("2026-02-02"), payment("2026-03-02")];
    expect(paidPerMonth(items, tl("2026-01-15", "2026-03-31", "2026-11-07"))).toEqual({
      amount: 16667,
      months: 3,
      count: 3,
    });
  });

  it("leaves out a month that ends before the earliest posting date", () => {
    const items = monthly([2, 3]);
    expect(paidPerMonth(items, tl("2026-01-01", "2026-03-31", "2026-11-07", "2026-02-10"))).toEqual({
      amount: 10000,
      months: 2,
      count: 2,
    });
  });

  it("gives one past month's own sum", () => {
    const items = [payment("2026-09-30", 5000), payment("2026-10-03", 7000), payment("2026-10-20", 8000)];
    expect(paidPerMonth(items, tl("2026-10-01", "2026-10-31", "2026-11-07"))).toEqual({
      amount: 15000,
      months: 1,
      count: 2,
    });
  });

  it("gives null when the period is only the running month", () => {
    expect(paidPerMonth([payment("2026-11-02")], tl("2026-11-01", "2026-11-07", "2026-11-07"))).toBeNull();
  });

  it("count leaves out the running month's items", () => {
    const items = [payment("2026-10-02"), payment("2026-11-02"), payment("2026-11-03")];
    expect(paidPerMonth(items, tl("2026-10-01", "2026-11-07", "2026-11-07"))?.count).toBe(1);
  });
});
