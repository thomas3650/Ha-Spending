import { classify, unitsOf, unitTotals } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/components/bars";
import { type BarItem, type Bars, isRunning } from "../src/components/bars";
import { kr, unitAxis, unitName } from "../src/format";
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
    name: unitName(unit, "month"),
    amount: totals[i],
    running: isRunning(unit, TODAY),
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
    expect(buttons[6]).toBe(getByRole(el, "button", { name: `${unitName(july, "month")}, ${kr(1510000)}` }));
    expect(buttons[9]).toBe(
      getByRole(el, "button", { name: `${unitName(october, "month")} (${da.inProgress}), ${kr(1131012)}` }),
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
