import { PALETTE, unitAt } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";

import { barKr, kr } from "../src/format";
import { da } from "../src/i18n/da";
import type { FixedBar, FixedPart } from "../src/model/fixed";
import { GREY, tooltipHtml, tooltipLines } from "../src/model/fixed-tooltip";

const TODAY = "2026-10-30";

interface Row {
  key: string | null;
  paid?: number;
  estimate?: number;
  due?: number;
}

/** August's bar; only the fields the tooltip reads are filled in with meaning. */
function barOf(rows: Row[]): FixedBar {
  const paid = new Map<string | null, number>();
  const estimate = new Map<string | null, number>();
  const due = new Map<string | null, number>();
  for (const r of rows) {
    if (r.paid !== undefined) paid.set(r.key, r.paid);
    if (r.estimate !== undefined) estimate.set(r.key, r.estimate);
    if (r.due !== undefined) due.set(r.key, r.due);
  }
  const sum = (m: Map<string | null, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    unit: unitAt("2026-08-01", "month", TODAY),
    name: "August",
    paid,
    estimate,
    due,
    paidSum: sum(paid),
    estimateSum: sum(estimate),
    label: "",
    sum: "",
    running: false,
  };
}

function partsOf(n: number): FixedPart[] {
  return Array.from({ length: n }, (_, i) => ({ key: `P${i}`, name: `Del ${i}`, colour: PALETTE[i % PALETTE.length] }));
}

const BOLIG: FixedPart = { key: "Bolig", name: "Bolig", colour: PALETTE[0] };
const BIL: FixedPart = { key: "Bil", name: "Bil", colour: PALETTE[1] };
const FRITID: FixedPart = { key: "Fritid", name: "Fritid", colour: PALETTE[2] };
const UNIT_LINE = { text: "August", colour: null, strong: false };

describe("the fixed bars' tooltip lines", () => {
  it("writes a paid part's sum and the total", () => {
    const lines = tooltipLines(barOf([{ key: "Bolig", paid: 800000 }]), [BOLIG, BIL]);
    expect(lines).toEqual([
      UNIT_LINE,
      { text: da.fixed.partLine("Bolig", kr(800000)), colour: BOLIG.colour, strong: false },
      { text: da.fixed.tooltipTotal(kr(800000)), colour: null, strong: true },
    ]);
  });

  it("writes a mixed part's paid sum and estimate, an estimates-only part's estimate, and keeps them apart in the total", () => {
    const bar = barOf([
      { key: "Bolig", paid: 800000, estimate: 90000 },
      { key: "Bil", estimate: 5000 },
    ]);
    expect(tooltipLines(bar, [BOLIG, BIL])).toEqual([
      UNIT_LINE,
      { text: da.fixed.partLine("Bolig", da.fixed.sum(kr(800000), kr(90000))), colour: BOLIG.colour, strong: false },
      { text: da.fixed.partLine("Bil", da.fixed.estimated(kr(5000))), colour: BIL.colour, strong: false },
      { text: da.fixed.tooltipTotal(da.fixed.sum(kr(800000), kr(95000))), colour: null, strong: true },
    ]);
  });

  it("keeps the parts' order, not the order the bar's payments came in", () => {
    const bar = barOf([
      { key: "Bil", estimate: 5000 },
      { key: "Bolig", paid: 800000 },
    ]);
    expect(tooltipLines(bar, [BOLIG, BIL]).map((l) => l.colour)).toEqual([null, BOLIG.colour, BIL.colour, null]);
  });

  it("writes an estimates-only bar's total as an estimate", () => {
    const lines = tooltipLines(barOf([{ key: "Bil", estimate: 5000 }]), [BOLIG, BIL]);
    expect(lines.map((l) => l.text)).toEqual([
      "August",
      da.fixed.partLine("Bil", da.fixed.estimated(kr(5000))),
      da.fixed.tooltipTotal(da.fixed.estimated(kr(5000))),
    ]);
  });

  it("marks a part holding a due estimate", () => {
    const bar = barOf([
      { key: "Bolig", paid: 800000 },
      { key: "Bil", estimate: 15000, due: 10000 },
    ]);
    const [, bolig, bil] = tooltipLines(bar, [BOLIG, BIL]);
    expect(bolig.text.endsWith(da.fixed.dueMark)).toBe(false);
    expect(bil.text).toBe(da.fixed.partLine("Bil", da.fixed.estimated(kr(15000))) + da.fixed.dueMark);
  });

  it("writes a refund part's negative sum as a refund", () => {
    const bar = barOf([
      { key: "Bolig", paid: 800000 },
      { key: "Fritid", paid: -50000 },
    ]);
    const lines = tooltipLines(bar, [BOLIG, FRITID]);
    expect(lines[2].text).toBe(da.fixed.partLine("Fritid", barKr(-50000)));
    expect(lines[2].text).toContain(`+${kr(50000)} ${da.refundMark}`);
    expect(lines[3].text).toBe(da.fixed.tooltipTotal(kr(750000)));
  });

  it("says an empty bar has no payments", () => {
    expect(tooltipLines(barOf([]), [BOLIG])).toEqual([
      UNIT_LINE,
      { text: da.fixed.noPaymentsTip, colour: null, strong: false },
    ]);
  });

  it("folds all but the nine biggest of eleven parts into one grey line, in the parts' order", () => {
    const parts = partsOf(11);
    const amounts = [900, 800, 700, 100, 600, 500, 400, 200, 300, 350, 450].map((n) => n * 100);
    // A refund counts by its size, so the large one keeps its line.
    amounts[5] = -90000;
    const bar = barOf(parts.map((p, i) => ({ key: p.key, paid: amounts[i] })));
    const lines = tooltipLines(bar, parts);
    const kept = [0, 1, 2, 4, 5, 6, 8, 9, 10];
    expect(lines.slice(1, 10)).toEqual(
      kept.map((i) => ({
        text: da.fixed.partLine(parts[i].name, barKr(amounts[i])),
        colour: parts[i].colour,
        strong: false,
      })),
    );
    expect(lines[10]).toEqual({ text: da.fixed.others(2, kr(10000 + 20000)), colour: GREY, strong: false });
    expect(lines[11].strong).toBe(true);
    expect(lines).toHaveLength(12);
  });

  it("keeps the parts' order among parts of the same size", () => {
    const parts = partsOf(11);
    const bar = barOf(parts.map((p) => ({ key: p.key, estimate: 10000 })));
    const lines = tooltipLines(bar, parts);
    expect(lines.slice(1, 10).map((l) => l.colour)).toEqual(parts.slice(0, 9).map((p) => p.colour));
    expect(lines[10].text).toBe(da.fixed.others(2, da.fixed.estimated(kr(20000))));
  });

  it("marks the folded line when a folded part is due", () => {
    const parts = partsOf(11);
    const bar = barOf(
      parts.map((p, i) =>
        i === 10 ? { key: p.key, paid: 100, estimate: 100, due: 100 } : { key: p.key, paid: 100000 - i * 1000 },
      ),
    );
    const folded = tooltipLines(bar, parts)[10];
    expect(folded).toEqual({
      text: da.fixed.others(2, da.fixed.sum(kr(91000 + 100), kr(100))) + da.fixed.dueMark,
      colour: GREY,
      strong: false,
    });
  });

  it("gives ten parts ten lines and no folded line", () => {
    const parts = partsOf(10);
    const lines = tooltipLines(barOf(parts.map((p, i) => ({ key: p.key, paid: (i + 1) * 1000 }))), parts);
    expect(lines).toHaveLength(12);
    expect(lines.slice(1, 11).map((l) => l.colour)).toEqual(parts.map((p) => p.colour));
    expect(lines.some((l) => l.colour === GREY)).toBe(false);
  });
});

describe("the fixed bars' tooltip HTML", () => {
  it("escapes a part's name", () => {
    const html = tooltipHtml([{ text: "a<b & c", colour: PALETTE[0], strong: false }]);
    expect(html).toContain("a&#60;b &#38; c");
    expect(html).not.toContain("<b");
    const el = document.createElement("div");
    el.innerHTML = html;
    expect(el.textContent).toBe("a<b & c");
  });
});
