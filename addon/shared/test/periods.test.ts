import { describe, expect, it } from "vitest";
import { PRESETS, presetPeriod } from "../src/periods";

describe("presetPeriod", () => {
  it("turns each preset into a period", () => {
    const t = "2026-10-30";
    expect(presetPeriod("thisMonth", t, null)).toEqual({ start: "2026-10-01", end: "2026-10-30" });
    expect(presetPeriod("lastMonth", t, null)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(presetPeriod("last3Months", t, null)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(presetPeriod("last12Months", t, null)).toEqual({ start: "2025-10-01", end: "2026-09-30" });
    expect(presetPeriod("thisYear", t, null)).toEqual({ start: "2026-01-01", end: "2026-10-30" });
    expect(presetPeriod("lastYear", t, null)).toEqual({ start: "2025-01-01", end: "2025-12-31" });
  });

  it("crosses the new year", () => {
    expect(presetPeriod("lastMonth", "2026-01-15", null)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(presetPeriod("last3Months", "2026-01-15", null)).toEqual({ start: "2025-10-01", end: "2025-12-31" });
    expect(presetPeriod("thisMonth", "2026-03-01", null)).toEqual({ start: "2026-03-01", end: "2026-03-01" });
  });

  it("Alt runs from the earliest posting to today", () => {
    expect(presetPeriod("all", "2026-10-30", "2023-01-03")).toEqual({ start: "2023-01-03", end: "2026-10-30" });
  });

  it("Alt is I år with no postings or an earliest date after today", () => {
    const thisYear = { start: "2026-01-01", end: "2026-10-30" };
    expect(presetPeriod("all", "2026-10-30", null)).toEqual(thisYear);
    expect(presetPeriod("all", "2026-10-30", "2026-11-05")).toEqual(thisYear);
  });

  it("lists the presets in the menu's order", () => {
    expect(PRESETS).toEqual(["thisMonth", "lastMonth", "last3Months", "last12Months", "thisYear", "lastYear", "all"]);
  });
});
