import { change, share, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import "../src/components/difference";
import type { DifferenceItem } from "../src/components/difference";
import { comparisonLabel, kr, partLabel, rangeText, signedKr, signedPercent, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { charts, forgetCharts } from "./chart-mock";
import { mount, settle, unmount } from "./mount";
import { KEEP_NBSP } from "./text";

const TODAY = "2026-10-30";
const JUL = unitAt("2026-07-01", "month", TODAY);
const JUN = unitAt("2026-06-01", "month", TODAY);
const JULY = 1510000;
const AVERAGE = 1115625;
const CHOSEN = "unit=2026-07-01&card=difference";

afterEach(() => {
  unmount();
  forgetCharts();
});

function julyName(): string {
  return unitName(JUL, "month");
}

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function forskel(root: HTMLElement, name: string): HTMLElement {
  return getByRole(root, "table", { name });
}

function rows(table: HTMLElement): [string, string][] {
  return getAllByRole(table, "row").map((row) => [
    getByRole(row, "rowheader").textContent?.trim() ?? "",
    getByRole(row, "cell").textContent?.trim() ?? "",
  ]);
}

function julyBar(root: HTMLElement): HTMLElement {
  const bars = getByRole(root, "region", { name: da.per("month") });
  return getByRole(bars, "button", { name: new RegExp(`^${julyName()},`) });
}

describe("screen 4, a chosen unit", () => {
  it("chooses July from its bar and shows Forskel", async () => {
    const { app, root } = await mount("");
    fireEvent.click(julyBar(root));
    await settle(app);
    expect(location.hash).toBe(`#${CHOSEN}`);
    expect(getByRole(viewSwitch(root), "button", { name: da.difference }).getAttribute("aria-pressed")).toBe("true");
    getByRole(root, "button", { name: da.remove(julyName()) });

    const first = getByRole(root, "group", { name: da.unitTotal(julyName()) });
    getByText(first, kr(JULY));
    getByText(first, rangeText({ start: "2026-07-01", end: "2026-07-31" }));

    const second = getByRole(root, "group", { name: da.vsAverage });
    getByText(second, signedPercent(change(JULY, AVERAGE) ?? 0), KEEP_NBSP);
    getByText(second, da.vsAverageSub(`${da.up} ${kr(394375)}`, kr(AVERAGE), "month"));

    const third = getByRole(root, "group", { name: comparisonLabel(JUL, JUN, "month") });
    getByText(third, signedPercent(change(JULY, 1100000) ?? 0), KEEP_NBSP);
    getByText(third, `${da.up} ${kr(410000)}`);
  });

  it("lists the differences per main group, largest first", async () => {
    const { root } = await mount(CHOSEN);
    const title = da.differenceTitle(julyName(), "month");
    getByRole(root, "region", { name: title });
    expect(rows(forskel(root, title))).toEqual([
      ["Mad", signedKr(193750)],
      [da.noMainGroup, signedKr(118125)],
      ["Bil", signedKr(82500)],
      ["Bolig", signedKr(0)],
    ]);
    for (const row of getAllByRole(forskel(root, title), "row")) expect(row.getAttribute("aria-current")).toBeNull();
    getByText(root, da.less);
    getByText(root, da.more);
  });

  it("shows the circle of July with its parts and shares", async () => {
    const { root } = await mount(CHOSEN);
    const card = getByRole(root, "region", { name: da.inUnit(da.mainGroups, julyName()) });
    getByRole(card, "heading", { name: da.inUnit(da.mainGroups, julyName()) });
    const parts: [string, number][] = [
      ["Bolig", 800000],
      ["Mad", 500000],
      [da.noMainGroup, 120000],
      ["Bil", 90000],
    ];
    const names = parts.map(([name, amount]) => partLabel(name, amount, share(amount, JULY)));
    expect(getAllByRole(card, "button")).toEqual(names.map((name) => getByRole(card, "button", { name })));
    getByText(card, julyName());
    expect(card.textContent).toContain(kr(JULY));
  });

  it("drills into Mad keeping July", async () => {
    const { app, root } = await mount(CHOSEN);
    fireEvent.click(getByRole(root, "button", { name: new RegExp("^Mad,") }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    getByRole(root, "button", { name: da.remove(julyName()) });
    const title = da.differenceTitle(julyName(), "month");
    expect(rows(forskel(root, title))).toEqual([
      ["Dagligvarer", signedKr(150000)],
      ["Café", signedKr(43750)],
    ]);
    const card = getByRole(root, "region", { name: da.inUnit(da.categories, julyName()) });
    getByText(card, da.levelInUnit("Mad", julyName()));
    expect(card.textContent).toContain(kr(500000));
  });

  it("marks the chosen category in Forskel", async () => {
    const { root } = await mount(`group=Mad&category=Caf%C3%A9&${CHOSEN}`);
    const table = forskel(root, da.differenceTitle(julyName(), "month"));
    expect(rows(table).map(([name]) => name)).toEqual(["Dagligvarer", "Café"]);
    const [groceries, cafe] = getAllByRole(table, "row");
    expect(cafe.getAttribute("aria-current")).toBe("true");
    expect(groceries.getAttribute("aria-current")).toBeNull();
    getByRole(root, "button", { name: da.remove("Café") });
    getByRole(root, "button", { name: da.remove(julyName()) });
  });

  it("drops the unit with its chip or a second click", async () => {
    const { app, root } = await mount(CHOSEN);
    fireEvent.click(getByRole(root, "button", { name: da.remove(julyName()) }));
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(julyName()) })).toBeNull();
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
    expect(queryByRole(viewSwitch(root), "button", { name: da.difference })).toBeNull();
    expect(location.hash).toBe("");

    fireEvent.click(julyBar(root));
    await settle(app);
    expect(location.hash).toBe(`#${CHOSEN}`);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(julyBar(root).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(julyBar(root));
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(julyName()) })).toBeNull();
    expect(location.hash).toBe("");
  });

  it("shows only the unit in Posteringer", async () => {
    const { root } = await mount("unit=2026-07-01&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    const groups = getAllByRole(card, "button", { expanded: true });
    expect(groups).toHaveLength(1);
    expect(queryByRole(card, "button", { expanded: false })).toBeNull();
    expect(groups[0]).toBe(getByRole(card, "button", { name: new RegExp(`^${julyName()},`) }));
  });

  it("drops a unit the new grouping does not have", async () => {
    const { app, root } = await mount(CHOSEN);
    const select = getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement;
    select.value = "week";
    fireEvent.change(select);
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(julyName()) })).toBeNull();
    expect(new URLSearchParams(location.hash.slice(1)).has("unit")).toBe(false);
  });
});

describe("hs-difference", () => {
  const items: DifferenceItem[] = [
    { key: "Mad", name: "Mad", difference: 193750, chosen: false },
    { key: "Bil", name: "Bil", difference: -82500, chosen: true },
    { key: null, name: da.noMainGroup, difference: null, chosen: false },
  ];

  async function element() {
    const el = document.createElement("hs-difference");
    el.items = items;
    el.title = "T";
    document.body.append(el);
    await el.updateComplete;
    return el;
  }

  it("names every row with its signed amount, or none", async () => {
    const el = await element();
    expect(rows(getByRole(el, "table", { name: "T" }))).toEqual([
      ["Mad", signedKr(193750)],
      ["Bil", signedKr(-82500)],
      [da.noMainGroup, da.none],
    ]);
    expect(getAllByRole(el, "row")[1].getAttribute("aria-current")).toBe("true");
  });

  it("draws again only when the rows change", async () => {
    const el = await element();
    expect(charts).toHaveLength(1);
    expect(charts[0].calls.setOption).toBe(1);
    el.title = "U";
    await el.updateComplete;
    getByRole(el, "table", { name: "U" });
    expect(charts[0].calls.setOption).toBe(1);
    el.items = items.slice(0, 2);
    await el.updateComplete;
    expect(charts[0].calls.setOption).toBe(2);
  });
});
