import { unitAt, unitsOf } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import {
  amountChip,
  axisKr,
  comparisonLabel,
  count,
  kr,
  partLabel,
  percent,
  postingAmount,
  rangeText,
  signedKr,
  signedPercent,
  shortDate,
  stepAmounts,
  tableDate,
  unitAxis,
  unitName,
} from "../src/format";

const today = "2026-10-30";
const unit = (date: string, g: Parameters<typeof unitAt>[1]) => unitAt(date, g, today);
const nbsp = " ";

describe("money", () => {
  it("formats key numbers without sign", () => {
    expect(kr(11566012)).toBe("115.660 kr.");
    expect(kr(-2500)).toBe("25 kr.");
  });
  it("signs differences", () => {
    expect(signedKr(193750)).toBe("+1.938 kr.");
    expect(signedKr(-2500)).toBe("-25 kr.");
    expect(signedKr(0)).toBe("0 kr.");
    expect(signedKr(-20)).toBe("0 kr.");
  });
  it("shows spending as minus and a refund as plus", () => {
    expect(postingAmount(31012)).toBe("-310,12");
    expect(postingAmount(-20000)).toBe("+200,00");
    expect(postingAmount(1131012)).toBe("-11.310,12");
  });
  it("words an amount range in whole kroner", () => {
    expect(amountChip({ min: 1000, max: 2500 })).toBe("Beløb: 1.000–2.500 kr.");
    expect(amountChip({ min: 100, max: null })).toBe("Beløb: fra 100 kr.");
    expect(amountChip({ min: null, max: 500 })).toBe("Beløb: til 500 kr.");
  });
  it("shortens axis values", () => {
    expect(axisKr(6200000)).toBe("62k");
    expect(axisKr(150000)).toBe("1,5k");
    expect(axisKr(68800)).toBe("688");
    expect(axisKr(0)).toBe("0");
  });
});

describe("percent", () => {
  it("rounds to whole per cents with a no-break space", () => {
    expect(percent(0.6917)).toBe(`69${nbsp}%`);
    expect(signedPercent(0.04545)).toBe(`+5${nbsp}%`);
    expect(signedPercent(-0.04)).toBe(`-4${nbsp}%`);
    expect(signedPercent(0)).toBe(`0${nbsp}%`);
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
});

describe("units", () => {
  it("names a unit", () => {
    expect(unitName(unit("2026-10-30", "day"), "day")).toBe("30.10.2026");
    expect(unitName(unit("2026-10-30", "week"), "week")).toBe("Uge 44 2026");
    expect(unitName(unit("2026-10-30", "month"), "month")).toBe("Oktober 2026");
    expect(unitName(unit("2026-10-30", "quarter"), "quarter")).toBe("4. kvartal 2026");
    expect(unitName(unit("2026-10-30", "year"), "year")).toBe("2026");
  });
  it("takes the week of a clipped unit from its whole week", () => {
    const first = unitsOf({ start: "2026-01-01", end: "2026-10-30" }, "week", today)[0];
    expect(unitName(first, "week")).toBe("Uge 1 2026");
  });
  it("short-names a unit on the axis", () => {
    expect(unitAxis(unit("2026-10-30", "day"), "day")).toBe("30.10.");
    expect(unitAxis(unit("2026-10-30", "week"), "week")).toBe("uge 44");
    expect(unitAxis(unit("2026-05-10", "month"), "month")).toBe("maj");
    expect(unitAxis(unit("2026-10-30", "quarter"), "quarter")).toBe("K4");
    expect(unitAxis(unit("2026-10-30", "year"), "year")).toBe("2026");
  });
  it("labels a comparison", () => {
    const pair = (date: string, before: string, g: Parameters<typeof unitAt>[1]) =>
      comparisonLabel(unit(date, g), unit(before, g), g);
    expect(pair("2026-09-10", "2026-08-10", "month")).toBe("September mod august");
    expect(pair("2026-01-10", "2025-12-10", "month")).toBe("Januar 2026 mod december 2025");
    expect(pair("2026-10-30", "2026-10-23", "week")).toBe("Uge 44 mod uge 43");
    expect(pair("2026-10-30", "2026-10-29", "day")).toBe("30.10. mod 29.10.");
    expect(pair("2026-10-30", "2026-07-30", "quarter")).toBe("4. kvartal mod 3. kvartal");
    expect(pair("2026-10-30", "2025-10-30", "year")).toBe("2026 mod 2025");
    expect(pair("2026-01-01", "2025-12-25", "week")).toBe("Uge 1 2026 mod uge 52 2025");
    expect(pair("2026-01-10", "2025-10-10", "quarter")).toBe("1. kvartal 2026 mod 4. kvartal 2025");
    expect(pair("2026-01-01", "2025-12-31", "day")).toBe("1.1.2026 mod 31.12.2025");
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
  it("writes a rise in whole kroner, or both with øre", () => {
    expect(stepAmounts(14900, 16900)).toEqual(["149", "169"]);
    expect(stepAmounts(14950, 14975)).toEqual(["149,50", "149,75"]);
    expect(stepAmounts(14900, 14975)).toEqual(["149,00", "149,75"]);
  });
});
