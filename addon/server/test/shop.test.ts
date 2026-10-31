import { describe, expect, it } from "vitest";
import { NO_SHOP, SHOP_LIMIT, byCodePoint, cleanShop, sameShop } from "../src/sorter/shop.js";

describe("cleanShop", () => {
  it("trims and normalises to NFC", () => {
    expect(cleanShop("Café ")).toBe("Café");
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["newline", "a\nb"],
    ["bidi override", "a‮b"],
    ["zero-width space", "a​b"],
    ["line separator", "a b"],
    ["paragraph separator", "a b"],
    ["lone surrogate", "\uD800"],
    ["the placeholder, any case", "(NO NAME)"],
    ["over the limit", "a".repeat(SHOP_LIMIT + 1)],
  ])("refuses %s", (_label, raw) => {
    expect(cleanShop(raw)).toBeNull();
  });

  it("counts code points, not UTF-16 units", () => {
    const name = "a".repeat(SHOP_LIMIT - 1) + "\u{1F600}";
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
});

describe("byCodePoint", () => {
  it("orders by code point, not UTF-16 unit", () => {
    expect(byCodePoint("\u{1F600}", "�")).toBeGreaterThan(0);
    expect(["\u{1F600}", "�"].sort(byCodePoint)).toEqual(["�", "\u{1F600}"]);
  });
  it("is zero for equal strings and negative when smaller", () => {
    expect(byCodePoint("a", "a")).toBe(0);
    expect(byCodePoint("a", "b")).toBeLessThan(0);
  });
});
