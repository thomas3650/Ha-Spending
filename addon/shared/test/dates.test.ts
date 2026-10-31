import { describe, expect, it } from "vitest";
import { addDays, isoWeek, localToday } from "../src/dates";

describe("addDays", () => {
  it("steps over a month end", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("ignores the summer time changes of the process's zone", () => {
    expect(addDays("2026-04-05", 1)).toBe("2026-04-06");
    expect(addDays("2026-09-27", -1)).toBe("2026-09-26");
    expect(addDays("2026-09-26", 1)).toBe("2026-09-27");
  });
});

describe("localToday", () => {
  it("names the day in the process's zone", () => {
    expect(localToday(new Date("2026-10-30T10:00:00Z"))).toBe("2026-10-30");
    expect(localToday(new Date("2026-10-30T12:00:00Z"))).toBe("2026-10-31");
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-01-01", 2026, 1],
    ["2025-12-29", 2026, 1],
    ["2024-12-30", 2025, 1],
    ["2026-12-31", 2026, 53],
    ["2027-01-01", 2026, 53],
    ["2026-10-30", 2026, 44],
  ])("puts %s in week %i-%i", (date, year, week) => {
    expect(isoWeek(date)).toEqual({ year, week });
  });
});
