import { describe, expect, it } from "vitest";
import { circle, greys, PALETTE } from "../src/circle";

describe("circle", () => {
  it("colours the eight largest from the palette, then greys", () => {
    const parts = Array.from({ length: 11 }, (_, i) => ({ key: `k${i}`, amount: (11 - i) * 100 }));
    const result = circle(parts);
    expect(result.map((p) => p.amount)).toEqual([1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]);
    expect(result.map((p) => p.colour)).toEqual([...PALETTE.slice(0, 8), "#8a8a8a", "#a7a7a7", "#c4c4c4"]);
    expect(result.every((p) => p.piece)).toBe(true);
  });

  it("gives a part of 0 or less no piece", () => {
    const result = circle([
      { key: "c", amount: -200 },
      { key: "b", amount: 0 },
      { key: "a", amount: 500 },
    ]);
    expect(result.map((p) => p.amount)).toEqual([500, 0, -200]);
    expect(result.map((p) => p.piece)).toEqual([true, false, false]);
    expect(result.map((p) => p.colour)).toEqual(["#2a78d6", "#c4c4c4", "#c4c4c4"]);
  });

  it("breaks ties by name with Uden last", () => {
    const result = circle([
      { key: null, amount: 5 },
      { key: "Øl", amount: 5 },
      { key: "Bil", amount: 5 },
    ]);
    expect(result.map((p) => p.key)).toEqual(["Bil", "Øl", null]);
  });

  it("makes greys lighter the smaller", () => {
    expect(greys(1)).toEqual(["#8a8a8a"]);
    expect(greys(2)).toEqual(["#8a8a8a", "#c4c4c4"]);
    expect(greys(0)).toEqual([]);
  });
});
