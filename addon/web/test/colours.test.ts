import { NO_PIECE } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";

import { categoryColours, circleItems, partColours } from "../src/model/circle";
import { viewContext } from "../src/model/context";
import { parseHash } from "../src/state/view";
import { answerFor } from "./fixture";

const TODAY = "2026-10-30";
const FETCHED = { start: "2025-01-01", end: TODAY };

function ctxOf(hash: string) {
  return viewContext(answerFor(FETCHED), parseHash(hash), TODAY);
}

function colourByKey(hash: string): Map<string | null, string> {
  return new Map(circleItems(ctxOf(hash)).map((i) => [i.key, i.colour]));
}

describe("the colours", () => {
  it("keeps the period's colours in a chosen unit's circle", () => {
    const period = colourByKey("");
    const july = circleItems(ctxOf("unit=2026-07-01"));
    expect(july.map((i) => i.key)).toEqual(["Bolig", "Mad", null, "Bil"]);
    for (const item of july) expect(item.colour).toBe(period.get(item.key));
  });

  it("keeps the period's colours in a chosen unit's circle of categories", () => {
    const period = colourByKey("group=Mad");
    for (const item of circleItems(ctxOf("group=Mad&unit=2026-07-01"))) expect(item.colour).toBe(period.get(item.key));
  });

  it("gives the bars of a chosen category the category's colour", () => {
    const cafe = colourByKey("group=Mad").get("Café");
    expect(cafe).toBeDefined();
    expect(partColours(ctxOf("group=Mad&category=Caf%C3%A9")).get("Café")).toBe(cafe);
    expect(partColours(ctxOf("group=Mad&category=Caf%C3%A9&unit=2026-07-01")).get("Café")).toBe(cafe);
  });

  it("keeps Uden kategori's circle colour while a main group is filtered", () => {
    const inCircle = colourByKey("group=").get(null);
    expect(inCircle).toBeDefined();
    expect(inCircle).not.toBe(NO_PIECE);
    expect(categoryColours(ctxOf("group=&view=all-postings")).get(null)).toBe(inCircle);
    expect(categoryColours(ctxOf("group=&category=&view=all-postings")).get(null)).toBe(inCircle);
  });

  it("greys Uden kategori without a main group filter", () => {
    expect(categoryColours(ctxOf("view=all-postings")).get(null)).toBe(NO_PIECE);
  });
});
