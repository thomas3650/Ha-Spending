import { describe, expect, it } from "vitest";
import { fetchRange, hasData, isOneUnit, isRunning, isWhole, unitAt, unitBefore, unitsOf } from "../src/units";

const thisYear = { start: "2026-01-01", end: "2026-10-30" };
const today = "2026-10-30";

describe("units", () => {
  it("clips the first unit at the period's start and counts it as whole (D16)", () => {
    const u = unitsOf({ start: "2026-01-15", end: today }, "month", today);
    expect(u).toHaveLength(10);
    expect(u[0]).toEqual({
      start: "2026-01-15",
      end: "2026-01-31",
      fullStart: "2026-01-01",
      fullEnd: "2026-01-31",
      partial: false,
      clipped: true,
    });
    expect(isWhole(u[0])).toBe(true);
    expect(isWhole(u[1])).toBe(true);
    expect(isWhole(u[9])).toBe(false);
  });

  it("groups by month with the running month partial", () => {
    const u = unitsOf(thisYear, "month", today);
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

  it("finds years and days", () => {
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

  it("ends months that roll into the next year, and leap Februaries", () => {
    expect(unitAt("2025-12-15", "month", today).fullEnd).toBe("2025-12-31");
    expect(unitAt("2028-02-10", "month", today).fullEnd).toBe("2028-02-29");
  });

  it("marks a unit after today partial", () => {
    expect(unitAt("2026-12-15", "month", today).partial).toBe(true);
  });

  it("steps to the unit before", () => {
    expect(unitBefore(unitAt("2026-01-01", "month", today), "month", today).fullStart).toBe("2025-12-01");
  });

  it("knows one-unit periods (D16)", () => {
    expect(isOneUnit({ start: "2026-10-01", end: "2026-10-30" }, "month", today)).toBe(true);
    expect(isOneUnit({ start: "2026-09-01", end: "2026-10-30" }, "month", today)).toBe(true);
    expect(isOneUnit({ start: "2025-01-01", end: "2025-12-31" }, "year", today)).toBe(true);
    expect(isOneUnit(thisYear, "month", today)).toBe(false);
  });

  it("widens a one-unit period by the 12 units before, and fetches a longer one from its first unit", () => {
    expect(fetchRange(thisYear, "month", today)).toEqual({ start: "2026-01-01", end: "2026-10-30" });
    expect(fetchRange({ start: "2026-01-15", end: today }, "month", today)).toEqual({
      start: "2026-01-01",
      end: "2026-10-30",
    });
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

describe("isRunning", () => {
  it("is true for a partial unit that has started by today", () => {
    const [u] = unitsOf({ start: "2026-10-01", end: "2026-10-30" }, "month", today);
    expect(isRunning(u, today)).toBe(true);
  });

  it("is false for a partial unit after today", () => {
    const [u] = unitsOf({ start: "2026-11-01", end: "2026-11-30" }, "month", today);
    expect(u.partial).toBe(true);
    expect(isRunning(u, today)).toBe(false);
  });

  it("is false for a whole unit", () => {
    const [u] = unitsOf({ start: "2026-09-01", end: "2026-09-30" }, "month", today);
    expect(isRunning(u, today)).toBe(false);
  });
});
