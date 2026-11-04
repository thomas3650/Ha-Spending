import { classify, isRunning, unitsOf, unitTotals } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/components/bars";
import { axisLabelShown, type BarItem, type Bars, barTooltip } from "../src/components/bars";
import { barKr, kr, rangeText, unitAxis, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { charts, forgetCharts } from "./chart-mock";
import { answerFor } from "./fixture";

const THIS_YEAR = { start: "2026-01-01", end: "2026-10-30" };
const TODAY = "2026-10-30";

function itemsOf(period: { start: string; end: string }): BarItem[] {
  const data = answerFor(period);
  const units = unitsOf(period, "month", TODAY);
  const totals = unitTotals(classify(data.postings, data.categories), units);
  return units.map((unit, i) => ({
    unit,
    axis: unitAxis(unit, "month"),
    name: unitName(unit, "month", false),
    amount: totals[i],
    running: isRunning(unit, TODAY),
    choose: unit.fullStart,
  }));
}

/** Three days of a one-month period, which choose nothing. */
function daysChoosingNothing(): BarItem[] {
  return unitsOf({ start: "2026-09-01", end: "2026-09-03" }, "day", TODAY).map((unit) => ({
    unit,
    axis: unitAxis(unit, "day"),
    name: unitName(unit, "day", false),
    amount: 0,
    running: false,
    choose: null,
  }));
}

function itemsOfThisYear(): BarItem[] {
  return itemsOf(THIS_YEAR);
}

interface RenderOptions {
  items?: BarItem[];
  average?: Bars["average"];
  chosen?: string | null;
}

async function render(opts: RenderOptions = {}) {
  const el = document.createElement("hs-bars");
  el.items = opts.items ?? itemsOfThisYear();
  el.colour = "#03a9f4";
  el.average = opts.average ?? null;
  el.chosen = opts.chosen ?? null;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
  forgetCharts();
});

describe("the bars", () => {
  it("names a bar per unit, the running one in progress", async () => {
    const items = itemsOfThisYear();
    const el = await render({ items });
    const buttons = getAllByRole(el, "button");
    expect(buttons).toHaveLength(10);
    const july = items[6].unit;
    const october = items[9].unit;
    expect(buttons[6]).toBe(getByRole(el, "button", { name: `${unitName(july, "month", false)}, ${kr(1510000)}` }));
    expect(buttons[9]).toBe(
      getByRole(el, "button", { name: `${unitName(october, "month", false)} (${da.inProgress}), ${kr(1131012)}` }),
    );
  });

  it("keeps a unit after today as an empty slot, not in progress", async () => {
    const items = itemsOf({ start: "2026-10-01", end: "2026-12-31" });
    const el = await render({ items });
    const november = items[1];
    getByRole(el, "button", { name: `${november.name}, ${kr(0)}` });
    expect(getAllByRole(el, "button", { name: new RegExp(`\\(${da.inProgress}\\)`) })).toEqual([
      getByRole(el, "button", { name: `${items[0].name} (${da.inProgress}), ${kr(items[0].amount)}` }),
    ]);
  });

  it("names a bar below zero with a plus", async () => {
    const items = itemsOfThisYear();
    items[3] = { ...items[3], amount: -20000 };
    const el = await render({ items });
    getByRole(el, "button", { name: `${items[3].name}, +${kr(20000)} ${da.refundMark}` });
    getByRole(el, "button", { name: `${items[6].name}, ${kr(items[6].amount)}` });
  });

  it("keeps an empty unit as a slot", async () => {
    const items = itemsOfThisYear();
    items[3] = { ...items[3], amount: 0 };
    const el = await render({ items });
    expect(getAllByRole(el, "button")).toHaveLength(10);
    getByRole(el, "button", { name: `${items[3].name}, ${kr(0)}` });
  });

  it("reports a click with the unit", async () => {
    const items = itemsOfThisYear();
    const el = await render({ items });
    const heard = vi.fn();
    document.body.addEventListener("unit-click", (e) => heard((e as CustomEvent).detail));
    fireEvent.click(getByRole(el, "button", { name: new RegExp(`^${items[6].name},`) }));
    expect(heard).toHaveBeenCalledWith({ fullStart: "2026-07-01" });
  });

  it("reports a click on a bar with its unit", async () => {
    const el = await render();
    const heard = vi.fn();
    el.addEventListener("unit-click", (e) => heard((e as CustomEvent).detail));
    expect(charts).toHaveLength(1);
    for (const handler of charts[0].clickHandlers) handler({ dataIndex: 6 });
    expect(heard).toHaveBeenCalledWith({ fullStart: "2026-07-01" });
  });

  it("names bars that choose nothing in a list without buttons", async () => {
    const items = daysChoosingNothing();
    const el = await render({ items });
    expect(queryAllByRole(el, "button")).toHaveLength(0);
    expect(getAllByRole(el, "listitem").map((li) => li.textContent?.trim())).toEqual(
      items.map((i) => `${i.name}, ${kr(0)}`),
    );
  });

  it("ignores a chart click on a bar that chooses nothing", async () => {
    const items = daysChoosingNothing();
    const el = await render({ items });
    const heard = vi.fn();
    el.addEventListener("unit-click", (e) => heard((e as CustomEvent).detail));
    for (const handler of charts[0].clickHandlers) handler({ dataIndex: 1 });
    expect(heard).not.toHaveBeenCalled();
  });

  it("redraws after a bar click, so the chosen bar comes from its properties", async () => {
    const el = await render();
    const before = charts[0].calls.setOption;
    for (const handler of charts[0].clickHandlers) handler({ dataIndex: 2 });
    await el.updateComplete;
    expect(charts[0].calls.setOption).toBe(before + 1);
  });

  it("shows a focused bar on the chart and clears it on blur", async () => {
    const items = itemsOfThisYear();
    const el = await render({ items });
    const march = getByRole(el, "button", { name: new RegExp(`^${items[2].name},`) });
    fireEvent.focus(march);
    expect(charts[0].calls.highlight).toEqual([2]);
    fireEvent.blur(march);
    expect(charts[0].calls.downplay).toEqual([2]);
  });

  it("hides the tooltip before a redraw while the pointer is away from the bars", async () => {
    const el = await render();
    fireEvent.pointerEnter(el, { pointerType: "mouse" });
    fireEvent.pointerLeave(el, { pointerType: "mouse" });
    charts[0].order.length = 0;
    el.items = itemsOf({ start: "2026-01-01", end: "2026-06-30" });
    await el.updateComplete;
    expect(charts[0].order).toEqual(["hideTip", "setOption"]);
  });

  it("keeps the tooltip on a redraw while the pointer is over the bars", async () => {
    const el = await render();
    fireEvent.pointerEnter(el, { pointerType: "mouse" });
    charts[0].order.length = 0;
    el.items = itemsOf({ start: "2026-01-01", end: "2026-06-30" });
    await el.updateComplete;
    expect(charts[0].order).toEqual(["setOption"]);
  });

  it("hides the tooltip when the window loses focus", async () => {
    const el = await render();
    fireEvent.pointerEnter(el, { pointerType: "mouse" });
    fireEvent.blur(window);
    expect(charts[0].calls.hideTip).toBe(1);
  });

  it("marks the chosen bar", async () => {
    const items = itemsOfThisYear();
    const el = await render({ items, chosen: "2026-07-01" });
    expect(getByRole(el, "button", { name: new RegExp(`^${items[6].name},`) }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByRole(el, "button", { name: new RegExp(`^${items[5].name},`) }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("names the average line", async () => {
    const label = da.average(kr(1159444));
    const el = await render({ average: { amount: 1159444, label } });
    getByText(el, label);
    const without = await render({ average: null });
    expect(queryByText(without, label)).toBeNull();
  });
});

describe("the bars' axis labels", () => {
  const shown = (count: number, running: number, most = 12) =>
    Array.from({ length: count }, (_, i) => i).filter((i) => axisLabelShown(i, count, running, most));

  it("names every bar while they are few", () => {
    expect(shown(12, 9)).toHaveLength(12);
  });

  it("skips labels evenly when the bars are many, keeping the running one", () => {
    expect(shown(44, 43)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 43]);
    expect(shown(44, -1)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40]);
    expect(shown(44, 43, 5)).toEqual([0, 9, 18, 27, 43]);
  });
});

describe("barTooltip", () => {
  function itemOf(period: { start: string; end: string }, grouping: "day" | "month"): BarItem {
    const unit = unitsOf(period, grouping, TODAY)[0];
    return {
      unit,
      axis: unitAxis(unit, grouping),
      name: unitName(unit, grouping, false),
      amount: 1234,
      running: false,
      choose: unit.fullStart,
    };
  }

  it("has name, range and amount for a whole month", () => {
    const item = itemOf({ start: "2026-09-01", end: "2026-09-30" }, "month");
    const range = rangeText({ start: item.unit.start, end: item.unit.end });
    expect(barTooltip(item).split("<br>")).toEqual([item.name, range, barKr(item.amount)]);
  });

  it("keeps the clipped range for a month clipped to one day", () => {
    const item = itemOf({ start: "2026-09-05", end: "2026-09-05" }, "month");
    expect(item.unit.fullStart).not.toBe(item.unit.fullEnd);
    const range = rangeText({ start: item.unit.start, end: item.unit.end });
    expect(range).toBe(rangeText({ start: "2026-09-05", end: "2026-09-05" }));
    expect(barTooltip(item).split("<br>")).toEqual([item.name, range, barKr(item.amount)]);
  });

  it("has only name and amount for a day", () => {
    const item = itemOf({ start: "2026-09-05", end: "2026-09-05" }, "day");
    expect(barTooltip(item).split("<br>")).toEqual([item.name, barKr(item.amount)]);
  });

  it("escapes the name", () => {
    const item = { ...itemOf({ start: "2026-09-05", end: "2026-09-05" }, "day"), name: "A<b> & C" };
    expect(barTooltip(item).split("<br>")[0]).toBe("A&#60;b&#62; &#38; C");
  });
});
