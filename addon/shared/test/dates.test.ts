import { describe, expect, it } from "vitest";
import { addDays, addMonths, isDate, isoWeek, localToday } from "../src/dates";

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

describe("addMonths", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2026-01-31", 2, "2026-03-31"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2026-11-15", 3, "2027-02-15"],
  ])("%s plus %i months is %s", (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
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

describe("isDate", () => {
  it.each(["2026-10-31", "2024-02-29", "0001-01-01"])("takes %s", (value) => {
    expect(isDate(value)).toBe(true);
  });

  it.each([undefined, "", "2026-1-31", "2026-02-30", "2025-02-29", "2026-13-01", "2026-10-31T00:00", " 2026-10-31"])(
    "refuses %s",
    (value) => {
      expect(isDate(value)).toBe(false);
    },
  );
});
