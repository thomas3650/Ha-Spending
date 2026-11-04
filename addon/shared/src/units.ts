import { addDays, firstOfMonth } from "./dates";
import type { Period } from "./types";

export type Grouping = "day" | "month" | "year";

export interface Unit {
  /** Clipped to the period. */
  start: string;
  end: string;
  /** The whole calendar unit. */
  fullStart: string;
  fullEnd: string;
  /** Still running on today, or after today. */
  partial: boolean;
  clipped: boolean;
}

export interface Timeline {
  period: Period;
  grouping: Grouping;
  today: string;
  earliest: string | null;
}

function fullBounds(date: string, grouping: Grouping): [string, string] {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  switch (grouping) {
    case "day":
      return [date, date];
    case "month":
      return [firstOfMonth(year, month), addDays(firstOfMonth(year, month + 1), -1)];
    case "year":
      return [firstOfMonth(year, 1), addDays(firstOfMonth(year + 1, 1), -1)];
  }
}

function makeUnit(fullStart: string, fullEnd: string, start: string, end: string, today: string): Unit {
  return {
    start,
    end,
    fullStart,
    fullEnd,
    partial: fullEnd >= today,
    clipped: start !== fullStart || end !== fullEnd,
  };
}

export function isRunning(unit: Unit, today: string): boolean {
  return unit.partial && unit.fullStart <= today;
}

export function unitAt(date: string, grouping: Grouping, today: string): Unit {
  const [fullStart, fullEnd] = fullBounds(date, grouping);
  return makeUnit(fullStart, fullEnd, fullStart, fullEnd, today);
}

export function unitBefore(unit: Unit, grouping: Grouping, today: string): Unit {
  return unitAt(addDays(unit.fullStart, -1), grouping, today);
}

export function unitsOf(period: Period, grouping: Grouping, today: string): Unit[] {
  const units: Unit[] = [];
  let date = period.start;
  while (date <= period.end) {
    const [fullStart, fullEnd] = fullBounds(date, grouping);
    const start = fullStart < period.start ? period.start : fullStart;
    const end = fullEnd > period.end ? period.end : fullEnd;
    units.push(makeUnit(fullStart, fullEnd, start, end, today));
    date = addDays(fullEnd, 1);
  }
  return units;
}

/** A clipped unit counts as whole (D16). */
export function isWhole(unit: Unit): boolean {
  return !unit.partial;
}

export function hasData(unit: Unit, earliest: string | null): boolean {
  return earliest !== null && unit.fullEnd >= earliest;
}

/** At most one whole unit (D16). */
export function isOneUnit(period: Period, grouping: Grouping, today: string): boolean {
  return unitsOf(period, grouping, today).filter(isWhole).length <= 1;
}

/** A one-unit period is widened by the 12 units before it, for its average (D16). */
export function fetchRange(period: Period, grouping: Grouping, today: string): Period {
  const steps = isOneUnit(period, grouping, today) ? 12 : 0;
  let unit = unitAt(period.start, grouping, today);
  for (let i = 0; i < steps; i++) unit = unitBefore(unit, grouping, today);
  return { start: unit.fullStart, end: period.end };
}
