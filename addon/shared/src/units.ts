import { addDays, firstOfMonth, isoWeekday } from "./dates";
import type { Period } from "./types";

export type Grouping = "day" | "week" | "month" | "quarter" | "year";

export interface Unit {
  /** Clipped to the period. */
  start: string;
  end: string;
  /** The whole calendar unit; an ISO week runs Monday to Sunday. */
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
    case "week": {
      const monday = addDays(date, 1 - isoWeekday(date));
      return [monday, addDays(monday, 6)];
    }
    case "month":
      return [firstOfMonth(year, month), addDays(firstOfMonth(year, month + 1), -1)];
    case "quarter": {
      const first = month - ((month - 1) % 3);
      return [firstOfMonth(year, first), addDays(firstOfMonth(year, first + 3), -1)];
    }
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

/** Widened so the comparisons have the unit before the last whole unit, and the unit before any chosen unit. */
export function fetchRange(period: Period, grouping: Grouping, today: string): Period {
  const steps = isOneUnit(period, grouping, today) ? 12 : 1;
  let unit = unitAt(period.start, grouping, today);
  for (let i = 0; i < steps; i++) unit = unitBefore(unit, grouping, today);
  return { start: unit.fullStart, end: period.end };
}
