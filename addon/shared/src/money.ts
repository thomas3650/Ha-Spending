import type { Category, Period, Posting } from "./types";
import { hasData, isOneUnit, isWhole, type Timeline, type Unit, unitAt, unitBefore, unitsOf } from "./units";

export interface ClassifiedPosting extends Posting {
  /** null is Uden hovedgruppe. */
  mainGroup: string | null;
}

export type Level =
  | { kind: "all" }
  | { kind: "mainGroup"; mainGroup: string | null }
  | { kind: "category"; mainGroup: string | null; category: string | null };

/** key null is Uden hovedgruppe or Uden kategori. */
export interface Part {
  key: string | null;
  amount: number;
}

export interface Average {
  amount: number | null;
  units: number;
  basis: "period" | "before";
}

export interface Comparison {
  unit: Unit;
  amount: number;
  before: Unit;
  beforeAmount: number | null;
}

export interface KeyNumbers {
  total: number;
  average: Average;
  comparison: Comparison | null;
}

export interface ChosenNumbers {
  amount: number;
  average: Average;
  before: Unit;
  beforeAmount: number | null;
}

export interface Difference {
  key: string | null;
  amount: number;
  average: number | null;
  difference: number | null;
}

const BEFORE_UNITS = 12;

export function compareKeys(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, "da");
}

export function classify(postings: Posting[], categories: Category[]): ClassifiedPosting[] {
  const mainGroups = new Map(categories.map((c) => [c.name, c.mainGroup]));
  return postings.map((p) => ({
    ...p,
    mainGroup: p.category === null ? null : (mainGroups.get(p.category) ?? null),
  }));
}

function inLevel(p: ClassifiedPosting, level: Level): boolean {
  if (level.kind === "all") return true;
  if (p.mainGroup !== level.mainGroup) return false;
  return level.kind === "mainGroup" || p.category === level.category;
}

export function select(
  postings: ClassifiedPosting[],
  level: Level,
  accounts: ReadonlySet<string> | null,
): ClassifiedPosting[] {
  return postings.filter((p) => inLevel(p, level) && (accounts === null || accounts.has(p.account)));
}

export function within(postings: ClassifiedPosting[], range: Period): ClassifiedPosting[] {
  return postings.filter((p) => p.date >= range.start && p.date <= range.end);
}

export function total(postings: ClassifiedPosting[]): number {
  return postings.reduce((sum, p) => sum + p.amount, 0);
}

export function parts(postings: ClassifiedPosting[], level: Level): Part[] {
  if (level.kind === "category") return [];
  const sums = new Map<string | null, number>();
  for (const p of select(postings, level, null)) {
    const key = level.kind === "all" ? p.mainGroup : p.category;
    sums.set(key, (sums.get(key) ?? 0) + p.amount);
  }
  return [...sums]
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => compareKeys(a.key, b.key));
}

export function share(amount: number, whole: number): number | null {
  return whole > 0 ? amount / whole : null;
}

function unitTotal(postings: ClassifiedPosting[], unit: Unit): number {
  return total(within(postings, unit));
}

export function unitTotals(postings: ClassifiedPosting[], units: Unit[]): number[] {
  return units.map((u) => unitTotal(postings, u));
}

function averageOf(sums: number[]): number | null {
  return sums.length === 0 ? null : Math.round(sums.reduce((s, x) => s + x, 0) / sums.length);
}

function beforeUnits(t: Timeline): Unit[] {
  const units: Unit[] = [];
  let unit = unitAt(t.period.start, t.grouping, t.today);
  for (let i = 0; i < BEFORE_UNITS; i++) {
    unit = unitBefore(unit, t.grouping, t.today);
    if (hasData(unit, t.earliest)) units.push(unit);
  }
  return units;
}

function averageUnits(t: Timeline, chosen: Unit | null): { units: Unit[]; basis: Average["basis"] } {
  if (isOneUnit(t.period, t.grouping, t.today)) return { units: beforeUnits(t), basis: "before" };
  const units = unitsOf(t.period, t.grouping, t.today).filter(
    (u) => isWhole(u) && hasData(u, t.earliest) && u.fullStart !== chosen?.fullStart,
  );
  return { units, basis: "period" };
}

function average(postings: ClassifiedPosting[], units: Unit[], basis: Average["basis"]): Average {
  return { amount: averageOf(unitTotals(postings, units)), units: units.length, basis };
}

/** Inside the period, the clipped unit, so the comparison matches the bar beside it. */
function unitBeforeIn(unit: Unit, t: Timeline): Unit {
  const before = unitBefore(unit, t.grouping, t.today);
  return unitsOf(t.period, t.grouping, t.today).find((u) => u.fullStart === before.fullStart) ?? before;
}

function beforeAmount(postings: ClassifiedPosting[], before: Unit, t: Timeline): number | null {
  return hasData(before, t.earliest) ? unitTotal(postings, before) : null;
}

export function keyNumbers(postings: ClassifiedPosting[], t: Timeline): KeyNumbers {
  const { units: averaged, basis } = averageUnits(t, null);
  const units = unitsOf(t.period, t.grouping, t.today);
  const unit = units.filter(isWhole).at(-1) ?? units.at(-1);
  let comparison: Comparison | null = null;
  if (unit) {
    const before = unitBeforeIn(unit, t);
    comparison = {
      unit,
      amount: unitTotal(postings, unit),
      before,
      beforeAmount: beforeAmount(postings, before, t),
    };
  }
  return {
    total: total(within(postings, t.period)),
    average: average(postings, averaged, basis),
    comparison,
  };
}

export function chosenUnitNumbers(postings: ClassifiedPosting[], t: Timeline, chosen: Unit): ChosenNumbers {
  const { units, basis } = averageUnits(t, chosen);
  const before = unitBeforeIn(chosen, t);
  return {
    amount: unitTotal(postings, chosen),
    average: average(postings, units, basis),
    before,
    beforeAmount: beforeAmount(postings, before, t),
  };
}

export function differences(
  postings: ClassifiedPosting[],
  level: Level,
  t: Timeline,
  chosen: Unit,
): Difference[] {
  const { units } = averageUnits(t, chosen);
  const sumsOf = (unit: Unit) => new Map(parts(within(postings, unit), level).map((p) => [p.key, p.amount]));
  const chosenSums = sumsOf(chosen);
  const unitSums = units.map(sumsOf);
  const rows = parts(within(postings, t.period), level).map(({ key }) => {
    const amount = chosenSums.get(key) ?? 0;
    const avg = averageOf(unitSums.map((sums) => sums.get(key) ?? 0));
    return { key, amount, average: avg, difference: avg === null ? null : amount - avg };
  });
  return rows.sort((a, b) => {
    if (a.difference === null || b.difference === null) {
      if (a.difference !== b.difference) return a.difference === null ? 1 : -1;
    } else if (Math.abs(a.difference) !== Math.abs(b.difference)) {
      return Math.abs(b.difference) - Math.abs(a.difference);
    }
    return compareKeys(a.key, b.key);
  });
}
