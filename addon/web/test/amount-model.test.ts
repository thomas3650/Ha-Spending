import { describe, expect, it } from "vitest";

import { da } from "../src/i18n/da";
import { aboutBounds, type AmountFilter, amountText, inAmount } from "../src/model/amount";

const at = (amount: number) => ({ amount });

describe("aboutBounds", () => {
  it("rounds each end to 50 kr. from 250 kr. up", () => {
    expect(aboutBounds(80_000)).toEqual({ min: 65_000, max: 95_000 });
    expect(aboutBounds(25_000)).toEqual({ min: 20_000, max: 30_000 });
  });

  it("rounds each end to whole kroner below 250 kr.", () => {
    expect(aboutBounds(10_000)).toEqual({ min: 8_000, max: 12_000 });
    expect(aboutBounds(12_345)).toEqual({ min: 9_900, max: 14_800 });
  });
});

describe("inAmount", () => {
  it("keeps everything without an amount", () => {
    expect(inAmount(at(400_000), null)).toBe(true);
  });

  it("leaves out the bound itself under Under", () => {
    const under: AmountFilter = { kind: "under", value: 400_000 };
    expect(inAmount(at(400_000), under)).toBe(false);
    expect(inAmount(at(399_999), under)).toBe(true);
    expect(inAmount(at(400_001), under)).toBe(false);
  });

  it("leaves out the bound itself under Over", () => {
    const over: AmountFilter = { kind: "over", value: 50_000 };
    expect(inAmount(at(50_000), over)).toBe(false);
    expect(inAmount(at(50_001), over)).toBe(true);
    expect(inAmount(at(49_999), over)).toBe(false);
  });

  it("keeps both ends under Mellem", () => {
    const between: AmountFilter = { kind: "between", min: 80_000, max: 120_000 };
    expect(inAmount(at(80_000), between)).toBe(true);
    expect(inAmount(at(120_000), between)).toBe(true);
    expect(inAmount(at(79_999), between)).toBe(false);
    expect(inAmount(at(120_001), between)).toBe(false);
  });

  it("keeps the rounded ends under Omkring", () => {
    const about: AmountFilter = { kind: "about", value: 80_000 };
    expect(inAmount(at(65_000), about)).toBe(true);
    expect(inAmount(at(95_000), about)).toBe(true);
    expect(inAmount(at(64_999), about)).toBe(false);
    expect(inAmount(at(95_001), about)).toBe(false);
  });

  it("compares the signed amount, so a refund is under any bound", () => {
    expect(inAmount(at(-50_000), { kind: "under", value: 10_000 })).toBe(true);
    expect(inAmount(at(-50_000), { kind: "over", value: 10_000 })).toBe(false);
  });
});

describe("amountText", () => {
  it("writes whole kroner with a thousands dot, and øre after a comma", () => {
    expect(amountText(80_000)).toBe("800");
    expect(amountText(120_000)).toBe("1.200");
    expect(amountText(100_050)).toBe("1.000,50");
    expect(amountText(5)).toBe("0,05");
  });
});

describe("the amount's words", () => {
  it("words each kind for the sentence", () => {
    expect(da.amountWords({ kind: "under", value: 400_000 })).toBe("under 4.000 kr.");
    expect(da.amountWords({ kind: "over", value: 50_000 })).toBe("over 500 kr.");
    expect(da.amountWords({ kind: "between", min: 80_000, max: 120_000 })).toBe("800–1.200 kr.");
    expect(da.amountWords({ kind: "about", value: 80_000 })).toBe("omkring 800 kr. (650–950 kr.)");
    expect(da.amountWords({ kind: "under", value: 100_050 })).toBe("under 1.000,50 kr.");
  });

  it("names the pill by its filter", () => {
    expect(da.amountName(null)).toBe("Beløb");
    expect(da.amountName({ kind: "about", value: 80_000 })).toBe("Beløb: omkring 800 kr.");
    expect(da.amountName({ kind: "between", min: 80_000, max: 120_000 })).toBe("Beløb: 800–1.200 kr.");
  });
});
