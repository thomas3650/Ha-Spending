import { addDays, firstOfMonth } from "./dates";
import type { Period } from "./types";

export type Preset = "thisMonth" | "lastMonth" | "last3Months" | "last12Months" | "thisYear" | "lastYear";

export const PRESETS: readonly Preset[] = [
  "thisMonth",
  "lastMonth",
  "last3Months",
  "last12Months",
  "thisYear",
  "lastYear",
];

/** "Sidste 3/12 måneder" are the whole months before the current one (UI spec §3.1). */
function monthsBefore(year: number, month: number, count: number): Period {
  return { start: firstOfMonth(year, month - count), end: addDays(firstOfMonth(year, month), -1) };
}

export function presetPeriod(preset: Preset, today: string): Period {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  switch (preset) {
    case "thisMonth":
      return { start: firstOfMonth(year, month), end: today };
    case "lastMonth":
      return monthsBefore(year, month, 1);
    case "last3Months":
      return monthsBefore(year, month, 3);
    case "last12Months":
      return monthsBefore(year, month, 12);
    case "thisYear":
      return { start: firstOfMonth(year, 1), end: today };
    case "lastYear":
      return { start: firstOfMonth(year - 1, 1), end: addDays(firstOfMonth(year, 1), -1) };
  }
}
