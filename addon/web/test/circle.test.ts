import { circle, classify, type Level, parts, share, total, within } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/components/circle";
import { parseRichText } from "zrender/lib/graphic/helper/parseText.js";
import { type CircleItem, type CircleSelection, labelText, ringRadius, ringStartAngle } from "../src/components/circle";
import { kr, partLabel } from "../src/format";
import { da } from "../src/i18n/da";
import { partName } from "../src/model/context";
import { charts, forgetCharts } from "./chart-mock";
import { answerFor } from "./fixture";

const THIS_YEAR = { start: "2026-01-01", end: "2026-10-30" };

function itemsOf(level: Level, of: "mainGroup" | "category"): CircleItem[] {
  const data = answerFor(THIS_YEAR);
  const postings = within(classify(data.postings, data.categories), THIS_YEAR);
  const split = parts(postings, level);
  const whole = total(postings.filter((p) => level.kind === "all" || p.mainGroup === level.mainGroup));
  return circle(split).map((p) => ({
    key: p.key,
    name: partName(p.key, of),
    amount: p.amount,
    share: share(p.amount, whole),
    colour: p.colour,
    piece: p.piece,
  }));
}

interface Options {
  items: CircleItem[];
  centreName?: string;
  centreAmount?: number;
  selected?: CircleSelection | null;
  selectable?: boolean;
}

async function render(opts: Options) {
  const el = document.createElement("hs-circle");
  el.items = opts.items;
  el.centreName = opts.centreName ?? da.allSpending;
  el.centreAmount = opts.centreAmount ?? opts.items.reduce((sum, i) => sum + i.amount, 0);
  el.selected = opts.selected ?? null;
  el.selectable = opts.selectable ?? false;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function piece(key: string, amount: number, s: number): CircleItem {
  return { key, name: key, amount, share: s, colour: "#2a78d6", piece: true };
}

afterEach(() => {
  document.body.replaceChildren();
  forgetCharts();
});

describe("the circle", () => {
  it("names every part as a button, largest first", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    const all = 11566012;
    const expected = [
      partLabel("Bolig", 8000000, 8000000 / all),
      partLabel("Mad", 3281012, 3281012 / all),
      partLabel("Bil", 150000, 150000 / all),
      partLabel(da.noMainGroup, 135000, 135000 / all),
    ];
    const buttons = getAllByRole(el, "button");
    expect(buttons).toEqual(expected.map((name) => getByRole(el, "button", { name })));
  });

  it("reports a click on a name with its key", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    const heard = vi.fn();
    document.body.addEventListener("part-click", (e) => heard((e as CustomEvent).detail));
    fireEvent.click(getByRole(el, "button", { name: new RegExp(`^${da.noMainGroup},`) }));
    expect(heard).toHaveBeenCalledWith({ key: null });
  });

  it("shows a focused name on the chart and clears it on blur", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    const bil = getByRole(el, "button", { name: /^Bil,/ });
    fireEvent.focus(bil);
    expect(charts[0].calls.highlight).toEqual([2]);
    fireEvent.blur(bil);
    expect(charts[0].calls.downplay).toEqual([2]);
  });

  it("reports a click on a piece with its key", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    const heard = vi.fn();
    el.addEventListener("part-click", (e) => heard((e as CustomEvent).detail));
    expect(charts).toHaveLength(1);
    for (const handler of charts[0].clickHandlers) handler({ dataIndex: 1 });
    expect(heard).toHaveBeenCalledWith({ key: "Mad" });
  });

  it("redraws the ring after a piece click, so the chosen part comes from its properties", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup"), selectable: true });
    const before = charts[0].calls.setOption;
    for (const handler of charts[0].clickHandlers) handler({ dataIndex: 0 });
    await el.updateComplete;
    expect(charts[0].calls.setOption).toBe(before + 1);
  });

  it("leaves the ring alone when only the middle changes", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    const before = charts[0].calls.setOption;
    el.centreAmount = 100;
    await el.updateComplete;
    getByText(el, kr(100));
    expect(charts[0].calls.setOption).toBe(before);
  });

  it("shows the total in the middle", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup"), centreName: da.allSpending });
    getByText(el, da.allSpending);
    getByText(el, kr(11566012));
  });

  it("marks the chosen part when selectable", async () => {
    const items = itemsOf({ kind: "mainGroup", mainGroup: "Mad" }, "category");
    const el = await render({ items, centreName: "Mad", selectable: true, selected: { key: "Café" } });
    expect(getByRole(el, "button", { name: /^Café,/ }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(el, "button", { name: /^Dagligvarer,/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("leaves the buttons unpressed when not selectable", async () => {
    const el = await render({ items: itemsOf({ kind: "all" }, "mainGroup") });
    expect(getAllByRole(el, "button").every((b) => !b.hasAttribute("aria-pressed"))).toBe(true);
  });

  it("lists a part with no piece under the ring", async () => {
    const items: CircleItem[] = [
      piece("Dagligvarer", 3150000, 1),
      { key: "Café", name: "Café", amount: 0, share: 0, colour: "#c4c4c4", piece: false },
    ];
    const el = await render({ items, centreName: "Mad" });
    const under = getByRole(el, "group", { name: da.noPiece });
    getByText(under, da.noPiece);
    getByRole(under, "button", { name: partLabel("Café", 0, 0) });
    expect(getAllByRole(el, "button", { name: /^Café,/ }).length).toBe(1);
  });

  it("turns the ring so the small pieces sit left", () => {
    const items = [piece("a", 69, 0.69), piece("b", 28, 0.28), piece("c", 13, 0.013), piece("d", 12, 0.012)];
    expect(ringStartAngle(items)).toBeCloseTo(175.5, 5);
    expect(ringStartAngle([piece("a", 60, 0.6), piece("b", 40, 0.4)])).toBe(90);
  });

  it("keeps the amount on lines of its own under a name, wrapped or not", () => {
    const item = piece("Mad og drikke ude i byen", 762800, 0.03);
    const lines = (width?: number) =>
      parseRichText(
        labelText(item),
        {
          overflow: "break",
          width,
          font: "12px sans-serif",
          rich: { name: { font: "12px sans-serif" }, sub: { font: "10px sans-serif" } },
        },
        null,
        null,
        "left",
      ).lines.map((line) => line.tokens.filter((t) => t.text !== "").map((t) => t.styleName));
    for (const laid of [lines(), lines(110)]) {
      const firstSub = laid.findIndex((line) => line.includes("sub"));
      expect(laid.slice(0, firstSub).every((line) => line.every((s) => s === "name"))).toBe(true);
      expect(laid.slice(firstSub).every((line) => line.every((s) => s === "sub"))).toBe(true);
    }
    expect(lines(110).filter((line) => line.includes("name")).length).toBeGreaterThan(1);
  });

  it("grows the ring with the room its labels leave, within limits", () => {
    expect(ringRadius(1000, 400)).toEqual([92, 124]);
    expect(ringRadius(500, 400)).toEqual([74, 100]);
    expect(ringRadius(350, 560)).toEqual([60, 81]);
  });
});
