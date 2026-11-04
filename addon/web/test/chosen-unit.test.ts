import { type Period, share, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { count, kr, partLabel, rangeText, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { forgetCharts } from "./chart-mock";
import { answerFor, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { cardNames, hasArrow } from "./text";

const TODAY = "2026-10-30";
const JUL = unitAt("2026-07-01", "month", TODAY);
const JULY = 1510000;
const CHOSEN = "unit=2026-07-01";

afterEach(() => {
  unmount();
  forgetCharts();
});

const JULY_GROUP = da.levelInUnit("Abonnementer", unitName(JUL, "month", false));
const SEPTEMBER = unitName(unitAt("2026-09-01", "month", TODAY), "month", false);

function julyName(): string {
  return unitName(JUL, "month", false);
}

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function julyBar(root: HTMLElement): HTMLElement {
  const bars = getByRole(root, "region", { name: da.per("month") });
  return getByRole(bars, "button", { name: new RegExp(`^${julyName()},`) });
}

describe("screen 4, a chosen unit", () => {
  it("chooses July from its bar and shows its postings", async () => {
    const { app, root } = await mount("");
    fireEvent.click(julyBar(root));
    await settle(app);
    expect(location.hash).toBe("#unit=2026-07-01&card=postings");
    expect(getByRole(viewSwitch(root), "button", { name: da.postings }).getAttribute("aria-pressed")).toBe("true");
    getByRole(root, "button", { name: da.remove(julyName()) });
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(location.hash).toBe(`#${CHOSEN}`);
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
    getByRole(root, "button", { name: da.remove(julyName()) });

    const first = getByRole(root, "group", { name: da.unitTotal(julyName()) });
    getByText(first, kr(JULY));
    getByText(first, rangeText({ start: "2026-07-01", end: "2026-07-31" }));
    expect(cardNames(root, [JULY_GROUP])).toEqual([da.unitTotal(julyName())]);
    expect(hasArrow(root)).toBe(false);
  });

  it("chooses July from the trail as from its bar", async () => {
    const { app, root } = await mount("");
    const trail = getByRole(root, "navigation", { name: da.trail });
    fireEvent.click(getByRole(trail, "button", { name: da.chooseMonth }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(trail, "group", { name: da.units }), "button", { name: `${julyName()}, ${kr(JULY)}` }));
    await settle(app);
    expect(location.hash).toBe("#unit=2026-07-01&card=postings");
    expect(getByRole(viewSwitch(root), "button", { name: da.postings }).getAttribute("aria-pressed")).toBe("true");
    getByRole(trail, "button", { name: da.switchMonth(julyName()) });
  });

  it("a chosen unit with nothing before it has only its sum", async () => {
    const onlyFrom = (from: string) => (range: Period) => {
      const answer = answerFor(range);
      return json({ ...answer, postings: answer.postings.filter((p) => p.date >= from) });
    };
    const empty = await mount(CHOSEN, { answer: onlyFrom("2026-07-01") });
    expect(cardNames(empty.root, [JULY_GROUP])).toEqual([da.unitTotal(julyName())]);
    expect(hasArrow(empty.root)).toBe(false);
    unmount();
    const first = await mount("unit=2026-01-01", { answer: onlyFrom("2026-01-01") });
    const january = unitName(unitAt("2026-01-01", "month", TODAY), "month", false);
    expect(cardNames(first.root, [da.levelInUnit("Abonnementer", january)])).toEqual([da.unitTotal(january)]);
    expect(hasArrow(first.root)).toBe(false);
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
    const card = getByRole(root, "region", { name: da.inUnit(da.categories, julyName()) });
    getByText(card, da.levelInUnit("Mad", julyName()));
    expect(card.textContent).toContain(kr(500000));
  });

  it("drops the unit with its × in the trail or a second click", async () => {
    const { app, root } = await mount(CHOSEN);
    const trail = getByRole(root, "navigation", { name: da.trail });
    fireEvent.click(getByRole(trail, "button", { name: da.remove(julyName()) }));
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(julyName()) })).toBeNull();
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("");

    fireEvent.click(julyBar(root));
    await settle(app);
    expect(location.hash).toBe("#unit=2026-07-01&card=postings");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(julyBar(root).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(julyBar(root));
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(julyName()) })).toBeNull();
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("");
  });

  it("has the same view buttons with a chosen unit as without, and no Forskel", async () => {
    const names = (root: HTMLElement) => getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim());
    const without = await mount("");
    expect(names(without.root)).toEqual([da.bars, da.postings, da.shops]);
    unmount();
    const chosen = await mount("unit=2026-07-01");
    expect(names(chosen.root)).toEqual([da.bars, da.postings, da.shops]);
    expect(queryByRole(viewSwitch(chosen.root), "button", { name: "Forskel" })).toBeNull();
  });

  it("shows only the unit in Posteringer", async () => {
    const { root } = await mount("unit=2026-07-01&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    const table = getByRole(card, "table");
    const groups = getAllByRole(table, "button", { expanded: true });
    expect(groups).toHaveLength(1);
    expect(queryByRole(table, "button", { expanded: false })).toBeNull();
    expect(groups[0]).toBe(getByRole(card, "button", { name: new RegExp(`^${julyName()},`) }));
  });
});

describe("the object group cards in a chosen unit", () => {
  const answer = (range: Period) => json(withSubscriptions(answerFor(range)));

  it("count the unit's payments, and a group with none keeps its card", async () => {
    const { root } = await mount("unit=2026-09-01", { answer });
    const subscriptions = getByRole(root, "group", { name: da.levelInUnit("Abonnementer", SEPTEMBER) });
    getByText(subscriptions, kr(70000));
    getByText(subscriptions, da.billCount(1));
    expect(subscriptions.textContent).not.toContain("pr. måned");
    const fixed = getByRole(root, "group", { name: da.levelInUnit("Faste udgifter", SEPTEMBER) });
    getByText(fixed, kr(0));
    getByText(fixed, da.noPayments);
  });

  it("the first key number's link keeps the unit and the main group, and the list counts the link's N", async () => {
    const { app, root } = await mount("unit=2026-09-01&group=Mad", { answer });
    const link = getByRole(getByRole(root, "group", { name: da.levelInUnit("Mad", SEPTEMBER) }), "link", {
      name: da.postingsLink(count(3)),
    });
    fireEvent.click(link);
    await settle(app);
    getByRole(root, "button", { name: da.fullScreen, pressed: true });
    getByRole(root, "button", { name: da.remove(SEPTEMBER) });
    getByText(root, da.summary(count(3), kr(350000)));
  });
});
