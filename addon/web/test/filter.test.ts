import type { ClassifiedPosting } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import { parseDanishAmount } from "../src/format";
import { inAmount, matches, shopSuggestions } from "../src/model/filter";

function posting(id: string, text: string, shop: string | null, amount: number): ClassifiedPosting {
  return { id, groupId: id, date: "2026-01-01", text, account: "1", category: null, kind: "spending", shop, amount, subscription: null, mainGroup: null };
}

const p = (text: string, shop: string | null) => posting("a", text, shop, 100);

describe("matches", () => {
  it("matches the text, ignoring case and the spaces around the search", () => {
    expect(matches(p("Café Søde", null), "  søde ", null)).toBe(true);
    expect(matches(p("Café Søde", null), "ROMA", null)).toBe(false);
    expect(matches(p("Café Søde", null), "   ", null)).toBe(true);
  });

  it("matches the shop as it matches the text", () => {
    expect(matches(p("VD 1234", "Netto"), "nett", null)).toBe(true);
    expect(matches(p("VD 1234", "Netto"), "vd 12", null)).toBe(true);
    expect(matches(p("VD 1234", "Netto"), "rema", null)).toBe(false);
    expect(matches(p("VD 1234", null), "nett", null)).toBe(false);
  });

  it("finds a Danish letter in the shop through spaces and case", () => {
    expect(matches(p("KORT 1", "Føtex"), "  FØTEX ", null)).toBe(true);
  });

  it("needs the exact shop once one is chosen", () => {
    expect(matches(p("a", "Coop"), "", "Coop")).toBe(true);
    expect(matches(p("a", "Coop 365"), "", "Coop")).toBe(false);
    expect(matches(p("a", null), "", "Coop")).toBe(false);
    expect(matches(p("a", "coop"), "", "Coop")).toBe(false);
  });

  it("needs a chosen shop and the text together", () => {
    expect(matches(p("VD 1234", "Netto"), "vd", "Netto")).toBe(true);
    expect(matches(p("KORT 9", "Netto"), "vd", "Netto")).toBe(false);
    expect(matches(p("VD 1234", "Rema"), "vd", "Netto")).toBe(false);
  });
});

describe("shopSuggestions", () => {
  it("is empty for a blank search", () => {
    expect(shopSuggestions([posting("a", "t", "Netto", 100)], "   ")).toEqual([]);
  });

  it("lists the shops that contain the search with their net sums, biggest first, ties by name", () => {
    const base = [
      posting("a", "t", "Netto", 10000),
      posting("b", "t", "Netto", 5000),
      posting("c", "t", "Netto Syd", 15000),
      posting("d", "t", "Netto Nord", 15000),
      posting("e", "t", "Rema", 99999),
      posting("f", "t", null, 99999),
    ];
    expect(shopSuggestions(base, "netto")).toEqual([
      { name: "Netto", sum: 15000 },
      { name: "Netto Nord", sum: 15000 },
      { name: "Netto Syd", sum: 15000 },
    ]);
  });

  it("subtracts a refund and lists a net of zero or less last", () => {
    const base = [
      posting("a", "t", "Coop", 10000),
      posting("b", "t", "Coop", -10000),
      posting("c", "t", "Coop 365", 500),
      posting("d", "t", "Coop Mad", -300),
    ];
    expect(shopSuggestions(base, "coop")).toEqual([
      { name: "Coop 365", sum: 500 },
      { name: "Coop", sum: 0 },
      { name: "Coop Mad", sum: -300 },
    ]);
  });

  it("offers at most 8 shops", () => {
    const base = Array.from({ length: 12 }, (_, i) => posting(`p${i}`, "t", `Shop ${String(i).padStart(2, "0")}`, 100 + i));
    const found = shopSuggestions(base, "shop");
    expect(found).toHaveLength(8);
    expect(found[0]).toEqual({ name: "Shop 11", sum: 111 });
  });

  it("lists the names starting with the text first, each tier by sum", () => {
    const base = [
      posting("a", "t", "Havesol", 90000),
      posting("b", "t", "Solbær Café", 5000),
      posting("c", "t", "Parasol & Co", 20000),
      posting("d", "t", "Solo Kiosk", 3000),
    ];
    expect(shopSuggestions(base, "sol").map((s) => s.name)).toEqual(["Solbær Café", "Solo Kiosk", "Havesol", "Parasol & Co"]);
  });

  it("keeps a starting name with the smallest sum although more shops match than the limit", () => {
    const base = [
      ...Array.from({ length: 9 }, (_, i) => posting(`p${i}`, "t", `Hus ${i} Sol`, 1000 + i)),
      posting("z", "t", "Solhat", 1),
    ];
    const found = shopSuggestions(base, "sol");
    expect(found).toHaveLength(8);
    expect(found[0]).toEqual({ name: "Solhat", sum: 1 });
  });

  it("finds a Danish name through spaces and case", () => {
    expect(shopSuggestions([posting("a", "t", "Føtex", 100)], "  føt ")).toEqual([{ name: "Føtex", sum: 100 }]);
  });

  it("keeps two shops that differ only in case apart, each with its own sum", () => {
    const base = [posting("a", "t", "netto", 100), posting("b", "t", "Netto", 300)];
    expect(shopSuggestions(base, "netto")).toEqual([
      { name: "Netto", sum: 300 },
      { name: "netto", sum: 100 },
    ]);
  });
});

describe("the amount bounds", () => {
  it("compares øre with øre, so a bound with øre holds its posting", () => {
    const max = parseDanishAmount("1.000,10");
    expect(inAmount(posting("a", "a", null, 100010), { min: null, max })).toBe(true);
    expect(inAmount(posting("a", "a", null, 100011), { min: null, max })).toBe(false);
    expect(inAmount(posting("a", "a", null, 100010), { min: max, max: null })).toBe(true);
    expect(inAmount(posting("a", "a", null, 100009), { min: max, max: null })).toBe(false);
  });
  it("a bound of 0 or 0,5 is a bound", () => {
    expect(inAmount(posting("a", "a", null, -100), { min: parseDanishAmount("0"), max: null })).toBe(false);
    expect(inAmount(posting("a", "a", null, 49), { min: parseDanishAmount("0,5"), max: null })).toBe(false);
    expect(inAmount(posting("a", "a", null, 50), { min: parseDanishAmount("0,5"), max: null })).toBe(true);
  });
});
