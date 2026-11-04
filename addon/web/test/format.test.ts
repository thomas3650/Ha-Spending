import { unitAt, unitsOf } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import {
  axisKr,
  axisTickKr,
  barKr,
  count,
  detailAmount,
  detailKr,
  kr,
  longDate,
  parseDanishAmount,
  parseTypedDate,
  partLabel,
  percent,
  postingAmount,
  rangeText,
  shortDate,
  stepAmounts,
  tableDate,
  typedDate,
  unitAxis,
  unitName,
  withYear,
} from "../src/format";
import { da } from "../src/i18n/da";

const today = "2026-10-30";
const unit = (date: string, g: Parameters<typeof unitAt>[1]) => unitAt(date, g, today);
const nbsp = " ";

describe("money", () => {
  it("formats key numbers without sign", () => {
    expect(kr(11566012)).toBe("115.660 kr.");
    expect(kr(-2500)).toBe("25 kr.");
  });
  it("axisTickKr writes a tick below zero without its sign", () => {
    expect(axisTickKr(-20000)).toBe(axisKr(20000));
    expect(axisTickKr(20000)).toBe(axisKr(20000));
  });

  it("barKr writes a bar below zero as a refund", () => {
    expect(barKr(-20000)).toBe(`+${kr(20000)} ${da.refundMark}`);
    expect(barKr(800000)).toBe(kr(800000));
    expect(barKr(0)).toBe(kr(0));
    expect(barKr(-40)).toBe(kr(0));
  });
  it("shows spending as minus and a refund as plus", () => {
    expect(postingAmount(31012)).toBe("-310,12");
    expect(postingAmount(-20000)).toBe("+200,00");
    expect(postingAmount(1131012)).toBe("-11.310,12");
  });
  it("reads a Danish amount as øre", () => {
    expect(parseDanishAmount("1000")).toBe(100000);
    expect(parseDanishAmount("1.000")).toBe(100000);
    expect(parseDanishAmount("1000,50")).toBe(100050);
    expect(parseDanishAmount("1.000,50")).toBe(100050);
    expect(parseDanishAmount("0,5")).toBe(50);
    expect(parseDanishAmount("0")).toBe(0);
    expect(parseDanishAmount(" 1.234.567,05 ")).toBe(123456705);
    expect(parseDanishAmount("0,07")).toBe(7);
  });
  it("refuses what is not a Danish amount", () => {
    for (const text of ["1,5,0", "1.00", "1,505", "abc", "", " ", "1e3", "-5", "1.0000", ".5", ",5", "1,", "1 000", "99999999999999999999"]) {
      expect(parseDanishAmount(text)).toBeNull();
    }
  });
  it("detailAmount writes øre with Posteringer's sign: spending minus, a refund plus", () => {
    expect(detailAmount(248000)).toBe("-2.480,00 kr.");
    expect(detailAmount(-15000)).toBe("+150,00 kr.");
    expect(detailAmount(0)).toBe("0,00 kr.");
  });
  it("detailKr writes whole kroner with the same sign", () => {
    expect(detailKr(514000)).toBe("5.140 kr.");
    expect(detailKr(-15000)).toBe("-150 kr.");
    expect(detailKr(-20)).toBe("0 kr.");
  });
  it("writes axis values in whole kroner with thousands dots", () => {
    expect(axisKr(6200000)).toBe("62.000");
    expect(axisKr(150000)).toBe("1.500");
    expect(axisKr(-200000)).toBe("-2.000");
    expect(axisKr(68800)).toBe("688");
    expect(axisKr(0)).toBe("0");
  });
});

describe("percent", () => {
  it("rounds to whole per cents with a no-break space", () => {
    expect(percent(0.6917)).toBe(`69${nbsp}%`);
    expect(percent(0.005)).toBe(`1${nbsp}%`);
  });
  it("reads a share above zero that rounds to 0 as under 1 %, and exactly 0 as 0 %", () => {
    expect(percent(0.001)).toBe(`<${nbsp}1${nbsp}%`);
    expect(percent(-0.001)).toBe(`<${nbsp}1${nbsp}%`);
    expect(percent(0)).toBe(`0${nbsp}%`);
  });
});

describe("dates", () => {
  it("formats table dates", () => {
    expect(tableDate("2026-10-26")).toBe("26.10.2026");
  });
  it("formats ranges", () => {
    expect(rangeText({ start: "2026-01-01", end: "2026-10-30" })).toBe("1. jan – 30. okt 2026");
    expect(rangeText({ start: "2026-07-01", end: "2026-07-31" })).toBe("1. – 31. jul 2026");
    expect(rangeText({ start: "2025-11-01", end: "2026-10-31" })).toBe("1. nov 2025 – 31. okt 2026");
    expect(rangeText({ start: "2026-10-30", end: "2026-10-30" })).toBe("30. okt 2026");
  });
  it("parses a typed date with one or two digits for the day and the month", () => {
    expect(parseTypedDate("03.01.2024")).toBe("2024-01-03");
    expect(parseTypedDate(" 3.1.2024 ")).toBe("2024-01-03");
  });
  it("refuses a typed date that is not a real day.month.year", () => {
    for (const text of ["31.02.2024", "2024-01-03", "3.1.24", ""]) expect(parseTypedDate(text)).toBeNull();
  });
  it("writes a date for typing and for a day's name", () => {
    expect(typedDate("2024-01-03")).toBe("03.01.2024");
    expect(longDate("2026-09-10")).toBe("10. september 2026");
  });
});

describe("units", () => {
  it("names a unit", () => {
    expect(unitName(unit("2026-10-30", "day"), "day", true)).toBe("30. oktober 2026");
    expect(unitName(unit("2026-10-30", "week"), "week", false)).toBe("Uge 44 2026");
    expect(unitName(unit("2026-10-30", "month"), "month", true)).toBe("Oktober 2026");
    expect(unitName(unit("2026-10-30", "quarter"), "quarter", false)).toBe("4. kvartal 2026");
    expect(unitName(unit("2026-10-30", "year"), "year", false)).toBe("2026");
  });
  it("leaves the year off a month and a day inside one year", () => {
    expect(unitName(unit("2026-08-12", "month"), "month", false)).toBe("August");
    expect(unitName(unit("2025-11-04", "day"), "day", false)).toBe("4. november");
    expect(unitName(unit("2025-11-04", "day"), "day", true)).toBe("4. november 2025");
    expect(unitName(unit("2026-10-30", "year"), "year", true)).toBe("2026");
  });
  it("knows when units cross a new year", () => {
    expect(withYear(unitsOf({ start: "2026-01-01", end: "2026-12-31" }, "month", today))).toBe(false);
    expect(withYear(unitsOf({ start: "2025-11-01", end: "2026-10-31" }, "month", today))).toBe(true);
  });
  it("takes the week of a clipped unit from its whole week", () => {
    const first = unitsOf({ start: "2026-01-01", end: "2026-10-30" }, "week", today)[0];
    expect(unitName(first, "week", false)).toBe("Uge 1 2026");
  });
  it("short-names a unit on the axis", () => {
    expect(unitAxis(unit("2026-10-30", "day"), "day")).toBe("30.10.");
    expect(unitAxis(unit("2026-10-30", "week"), "week")).toBe("uge 44");
    expect(unitAxis(unit("2026-05-10", "month"), "month")).toBe("maj");
    expect(unitAxis(unit("2026-10-30", "quarter"), "quarter")).toBe("K4");
    expect(unitAxis(unit("2026-10-30", "year"), "year")).toBe("2026");
  });
});

describe("labels", () => {
  it("builds a part label", () => {
    expect(partLabel("Mad", 3281000, 0.28)).toBe(`Mad, 32.810 kr., 28${nbsp}%`);
    expect(partLabel("Mad", 3281000, null)).toBe("Mad, 32.810 kr.");
  });
  it("counts postings", () => {
    expect(count(0)).toBe("0 posteringer");
    expect(count(1)).toBe("1 postering");
    expect(count(4)).toBe("4 posteringer");
  });
});

describe("subscriptions", () => {
  it("writes a date short, with the year only when it is not today's", () => {
    expect(shortDate("2026-11-01", "2026-10-30")).toBe("1. nov");
    expect(shortDate("2027-01-01", "2026-10-30")).toBe("1. jan 2027");
  });
  it("writes a rise in whole kroner", () => {
    expect(stepAmounts(14900, 16900)).toEqual(["149", "169"]);
    expect(stepAmounts(40000, 45050)).toEqual(["400", "451"]);
    expect(stepAmounts(9900, 10060)).toEqual(["99", "101"]);
    expect(stepAmounts(14970, 15070)).toEqual(["150", "151"]);
  });
});
