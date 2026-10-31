import { describe, expect, it } from "vitest";
import { PRESETS, presetPeriod } from "../src/periods";

describe("presetPeriod", () => {
  it("turns each preset into a period", () => {
    const t = "2026-10-30";
    expect(presetPeriod("thisMonth", t)).toEqual({ start: "2026-10-01", end: "2026-10-30" });
    expect(presetPeriod("lastMonth", t)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(presetPeriod("last3Months", t)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(presetPeriod("last12Months", t)).toEqual({ start: "2025-10-01", end: "2026-09-30" });
    expect(presetPeriod("thisYear", t)).toEqual({ start: "2026-01-01", end: "2026-10-30" });
    expect(presetPeriod("lastYear", t)).toEqual({ start: "2025-01-01", end: "2025-12-31" });
  });

  it("crosses the new year", () => {
    expect(presetPeriod("lastMonth", "2026-01-15")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(presetPeriod("last3Months", "2026-01-15")).toEqual({ start: "2025-10-01", end: "2025-12-31" });
    expect(presetPeriod("thisMonth", "2026-03-01")).toEqual({ start: "2026-03-01", end: "2026-03-01" });
  });

  it("lists the presets in the menu's order", () => {
    expect(PRESETS).toEqual(["thisMonth", "lastMonth", "last3Months", "last12Months", "thisYear", "lastYear"]);
  });
});
