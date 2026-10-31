import { describe, expect, it } from "vitest";
import { fetchRange, hasData, isOneUnit, isWhole, unitAt, unitBefore, unitsOf } from "../src/units";

const iAar = { start: "2026-01-01", end: "2026-10-30" };
const today = "2026-10-30";

describe("units", () => {
  it("clips the first and last ISO week of I år", () => {
    const u = unitsOf(iAar, "week", today);
    expect(u).toHaveLength(44);
    expect(u[0]).toEqual({
      start: "2026-01-01",
      end: "2026-01-04",
      fullStart: "2025-12-29",
      fullEnd: "2026-01-04",
      partial: false,
      clipped: true,
    });
    expect(u[43]).toEqual({
      start: "2026-10-26",
      end: "2026-10-30",
      fullStart: "2026-10-26",
      fullEnd: "2026-11-01",
      partial: true,
      clipped: true,
    });
    expect(isWhole(u[0])).toBe(true);
    expect(isWhole(u[1])).toBe(true);
    expect(isWhole(u[43])).toBe(false);
  });

  it("keeps week 53 of 2026 one unit across the new year", () => {
    const u = unitsOf({ start: "2026-12-28", end: "2027-01-03" }, "week", "2027-02-01");
    expect(u).toHaveLength(1);
    expect(u[0].fullStart).toBe("2026-12-28");
    expect(u[0].fullEnd).toBe("2027-01-03");
    expect(isWhole(u[0])).toBe(true);
  });

  it("groups by month with the running month partial", () => {
    const u = unitsOf(iAar, "month", today);
    expect(u).toHaveLength(10);
    expect(u[9]).toMatchObject({
      start: "2026-10-01",
      end: "2026-10-30",
      fullEnd: "2026-10-31",
      partial: true,
      clipped: true,
    });
    expect(isWhole(u[8])).toBe(true);
  });

  it("finds quarters, years and days", () => {
    expect(unitAt("2026-08-15", "quarter", today)).toMatchObject({
      fullStart: "2026-07-01",
      fullEnd: "2026-09-30",
      partial: false,
    });
    expect(unitAt("2026-08-15", "year", today)).toMatchObject({
      fullStart: "2026-01-01",
      fullEnd: "2026-12-31",
      partial: true,
    });
    const days = unitsOf({ start: "2026-10-29", end: "2026-10-30" }, "day", today);
    expect(days).toHaveLength(2);
    expect(isWhole(days[0])).toBe(true);
    expect(isWhole(days[1])).toBe(false);
  });

  it("marks a unit after today partial", () => {
    expect(unitAt("2026-12-15", "month", today).partial).toBe(true);
  });

  it("steps to the unit before", () => {
    expect(unitBefore(unitAt("2026-01-01", "month", today), "month", today).fullStart).toBe("2025-12-01");
    expect(unitBefore(unitAt("2026-01-01", "week", today), "week", today).fullStart).toBe("2025-12-22");
  });

  it("knows one-unit periods (D16)", () => {
    expect(isOneUnit({ start: "2026-10-01", end: "2026-10-30" }, "month", today)).toBe(true);
    expect(isOneUnit({ start: "2026-09-01", end: "2026-10-30" }, "month", today)).toBe(true);
    expect(isOneUnit({ start: "2026-07-01", end: "2026-09-30" }, "quarter", today)).toBe(true);
    expect(isOneUnit(iAar, "month", today)).toBe(false);
  });

  it("widens the range for the comparisons", () => {
    expect(fetchRange(iAar, "month", today)).toEqual({ start: "2025-12-01", end: "2026-10-30" });
    expect(fetchRange(iAar, "week", today)).toEqual({ start: "2025-12-22", end: "2026-10-30" });
    expect(fetchRange({ start: "2026-10-01", end: "2026-10-30" }, "month", today)).toEqual({
      start: "2025-10-01",
      end: "2026-10-30",
    });
    expect(fetchRange({ start: "2025-01-01", end: "2025-12-31" }, "year", today)).toEqual({
      start: "2013-01-01",
      end: "2025-12-31",
    });
  });

  it("knows which units have data", () => {
    expect(hasData(unitAt("2025-11-15", "month", today), "2025-12-03")).toBe(false);
    expect(hasData(unitAt("2025-12-15", "month", today), "2025-12-03")).toBe(true);
    expect(hasData(unitAt("2025-12-15", "month", today), null)).toBe(false);
  });
});
