import { describe, expect, it } from "vitest";
import { NO_SHOP, SHOP_LIMIT, byCodePoint, cleanShop, sameShop } from "../src/sorter/shop.js";

// Built from code points so no invisible or non-ASCII character sits in this file.
const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const COMBINING_ACUTE = cp(0x0301);
const E_ACUTE = cp(0xe9);
const BIDI_OVERRIDE = cp(0x202e);
const ZERO_WIDTH_SPACE = cp(0x200b);
const LINE_SEPARATOR = cp(0x2028);
const PARAGRAPH_SEPARATOR = cp(0x2029);
const LONE_SURROGATE = cp(0xd800);
const GRINNING_FACE = cp(0x1f600);
const REPLACEMENT = cp(0xfffd);

describe("cleanShop", () => {
  it("trims and normalises to NFC", () => {
    const raw = "Cafe" + COMBINING_ACUTE + " ";
    const cleaned = cleanShop(raw);
    expect(cleaned).toBe("Caf" + E_ACUTE);
    expect(cleaned).not.toBe(raw);
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["newline", "a\nb"],
    ["bidi override", "a" + BIDI_OVERRIDE + "b"],
    ["zero-width space", "a" + ZERO_WIDTH_SPACE + "b"],
    ["line separator", "a" + LINE_SEPARATOR + "b"],
    ["paragraph separator", "a" + PARAGRAPH_SEPARATOR + "b"],
    ["lone surrogate", LONE_SURROGATE],
    ["the placeholder, any case", "(NO NAME)"],
    ["over the limit", "a".repeat(SHOP_LIMIT + 1)],
  ])("refuses %s", (_label, raw) => {
    expect(cleanShop(raw)).toBeNull();
  });

  it("counts code points, not UTF-16 units", () => {
    const name = "a".repeat(SHOP_LIMIT - 1) + GRINNING_FACE;
    expect(cleanShop(name)).toBe(name);
    expect(cleanShop(name + "a")).toBeNull();
  });

  it("exports the placeholder", () => {
    expect(NO_SHOP).toBe("(no name)");
  });
});

describe("sameShop", () => {
  it("ignores case", () => {
    expect(sameShop("Netto")).toBe(sameShop("NETTO"));
  });

  it("ignores case of non-ASCII letters", () => {
    expect(sameShop("B" + cp(0xc5) + "r")).toBe(sameShop("B" + cp(0xe5) + "r"));
  });
});

describe("byCodePoint", () => {
  it("orders by code point, not UTF-16 unit", () => {
    expect(byCodePoint(GRINNING_FACE, REPLACEMENT)).toBeGreaterThan(0);
    expect([GRINNING_FACE, REPLACEMENT].sort(byCodePoint)).toEqual([REPLACEMENT, GRINNING_FACE]);
  });
  it("is zero for equal strings and negative when smaller", () => {
    expect(byCodePoint("a", "a")).toBe(0);
    expect(byCodePoint("a", "b")).toBeLessThan(0);
  });
});
