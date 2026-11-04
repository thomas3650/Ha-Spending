import { share, unitAt } from "@ha-spending/shared";
import {
  fireEvent,
  getAllByRole,
  getAllByText,
  getByRole,
  getByText,
  queryByRole,
  within,
} from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { kr, partLabel, percent, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { partName } from "../src/model/context";
import { OBJECT_GROUP } from "./fixture";
import { mount, settle, unmount } from "./mount";
import { cardNames, hasArrow, KEEP_NBSP } from "./text";

const TODAY = "2026-10-30";
const TOTAL = 11566012;
const MAD = 3281012;
const CAFE = 131012;

afterEach(unmount);

function circleCard(root: HTMLElement): HTMLElement {
  return getByRole(root, "region", { name: da.categories });
}

function trail(root: HTMLElement): HTMLElement {
  return getByRole(root, "navigation", { name: da.trail });
}

function expectHeading(root: HTMLElement, text: string): void {
  expect(getByRole(root, "heading", { level: 1 }).textContent?.trim()).toBe(text);
}

function cafeButton(root: HTMLElement): HTMLElement {
  return getByRole(circleCard(root), "button", { name: new RegExp("^Café,") });
}

function inOrder(card: HTMLElement, names: string[]): HTMLElement[] {
  return names.map((name) => getByRole(card, "button", { name: new RegExp(`^${name},`) }));
}

describe("screen 2, a main group", () => {
  it("shows a main group with its share of all spending", async () => {
    const { root } = await mount("group=Mad");
    expectHeading(root, "Mad");
    expect(getByRole(trail(root), "link", { name: da.allSpending }).getAttribute("href")).toBe("#");
    const first = getByRole(root, "group", { name: da.inPeriod("Mad") });
    getByText(first, kr(MAD));
    getByText(first, da.shareOfAll(percent(share(MAD, TOTAL) ?? 0)), KEEP_NBSP);

    const card = circleCard(root);
    getByRole(card, "heading", { name: da.categories });
    expect(getAllByRole(card, "button")).toEqual(inOrder(card, ["Dagligvarer", "Café"]));
    for (const b of getAllByRole(card, "button")) expect(b.getAttribute("aria-pressed")).toBe("false");
    getByText(card, "Mad");
    expect(getAllByText(card, kr(MAD))).toHaveLength(2);
    getByText(card, da.circleHintGroup);

    const right = getByRole(root, "region", { name: da.levelPer("Mad", "month") });
    expect(queryByRole(right, "button", { name: new RegExp(`^${da.remove("")}`) })).toBeNull();
  });

  it("filters to a category and back with a second click", async () => {
    const { app, root } = await mount("group=Mad");
    fireEvent.click(cafeButton(root));
    await settle(app);
    expectHeading(root, "Café");
    expect(cafeButton(root).getAttribute("aria-pressed")).toBe("true");
    const first = getByRole(root, "group", { name: da.inPeriod("Café") });
    getByText(first, kr(CAFE));
    getByText(first, da.shareOf(percent(share(CAFE, MAD) ?? 0), "Mad"), KEEP_NBSP);
    expect(location.hash).toBe("#group=Mad&category=Caf%C3%A9");
    getByText(circleCard(root), da.chosenHint("Mad"));
    getByRole(root, "region", { name: da.levelPer("Café", "month") });

    fireEvent.click(cafeButton(root));
    await settle(app);
    expectHeading(root, "Mad");
    expect(location.hash).toBe("#group=Mad");
  });

  it("removes the category with its × in the trail", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    fireEvent.click(getByRole(trail(root), "button", { name: da.remove("Café") }));
    await settle(app);
    expectHeading(root, "Mad");
    expect(location.hash).toBe("#group=Mad");
    expect(queryByRole(root, "button", { name: da.remove("Café") })).toBeNull();
  });

  it("titles the right card by the chosen category, with no chip", async () => {
    const { root } = await mount("group=Mad&category=Café");
    const right = getByRole(root, "region", { name: da.levelPer("Café", "month") });
    const heading = getByRole(right, "heading", { name: da.levelPer("Café", "month") });
    expect(heading.textContent).not.toContain("Mad");
    expect(queryByRole(right, "button", { name: da.remove("Café") })).toBeNull();
  });

  it("titles Posteringer and Butikker by the chosen category", async () => {
    const postings = await mount("group=Mad&category=Café&card=postings");
    getByRole(postings.root, "region", { name: da.postingsOf("Café") });
    unmount();
    const shops = await mount("group=Mad&category=Café&card=shops");
    getByRole(shops.root, "region", { name: da.shopsIn("Café") });
  });

  it("titles the right card by the main group with no category chosen", async () => {
    const { root } = await mount("group=Mad");
    getByRole(root, "region", { name: da.levelPer("Mad", "month") });
    unmount();
    const postings = await mount("group=Mad&card=postings");
    getByRole(postings.root, "region", { name: da.postingsOf("Mad") });
  });

  it("titles the right card by Uden kategori under a main group", async () => {
    const { root } = await mount("group=Mad&category=");
    getByRole(root, "region", { name: da.levelPer(da.noCategory, "month") });
  });

  it("shows the key numbers of the main group", async () => {
    const { root } = await mount("group=Mad");
    expect(cardNames(root, [OBJECT_GROUP])).toEqual([da.inPeriod("Mad"), da.averagePer("month")]);
    expect(hasArrow(root)).toBe(false);
  });

  it("goes back up through the trail", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    fireEvent.click(getByRole(trail(root), "button", { name: da.remove("Café") }));
    await settle(app);
    expectHeading(root, "Mad");
    fireEvent.click(getByRole(trail(root), "link", { name: da.allSpending }));
    await settle(app);
    expectHeading(root, da.presets.thisYear);
  });

  it("keeps the period and accounts while drilling down", async () => {
    const { app, root } = await mount("period=thisYear&accounts=2");
    fireEvent.click(getByRole(root, "button", { name: new RegExp("^Mad,") }));
    await settle(app);
    expect(location.hash).toBe("#accounts=2&group=Mad");
    const first = getByRole(root, "group", { name: da.inPeriod("Mad") });
    getByText(first, kr(CAFE));
    getByText(first, da.shareOfAll(percent(share(CAFE, 281012) ?? 0)), KEEP_NBSP);
    const card = circleCard(root);
    expect(getAllByRole(card, "button")).toEqual([getByRole(card, "button", { name: partLabel("Café", CAFE, 1) })]);
    expect(getAllByText(card, kr(CAFE))).toHaveLength(2);
  });

  it("filters to Uden kategori with its × in the trail", async () => {
    const { app, root } = await mount("group=");
    const button = () => getByRole(circleCard(root), "button", { name: new RegExp(`^${da.noCategory},`) });
    fireEvent.click(button());
    await settle(app);
    expectHeading(root, da.noCategory);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("#group=&category=");
    getByRole(root, "region", { name: da.levelPer(da.noCategory, "month") });
    getByRole(trail(root), "button", { name: da.remove(da.noCategory) });
  });

  it("keeps the chosen unit while filtering to a category", async () => {
    const { app, root } = await mount("group=Mad&unit=2026-09-01");
    const sep = unitName(unitAt("2026-09-01", "month", TODAY), "month", false);
    const card = getByRole(root, "region", { name: da.inUnit(da.categories, sep) });
    fireEvent.click(getByRole(card, "button", { name: new RegExp("^Café,") }));
    await settle(app);
    expectHeading(root, "Café");
    const params = new URLSearchParams(location.hash.slice(1));
    expect(params.get("category")).toBe("Café");
    expect(params.get("unit")).toBe("2026-09-01");
  });

  it("shows Uden hovedgruppe with its categories", async () => {
    const { root } = await mount("group=");
    const card = circleCard(root);
    expect(getAllByRole(card, "button")).toEqual(inOrder(card, [partName("Gaver", "category"), da.noCategory]));
  });
});

describe("switching sideways from the trail", () => {
  const BOLIG = 8000000;
  const BIL = 150000;
  const NONE = 135000;
  const DAGLIGVARER = MAD - CAFE;

  function list(root: HTMLElement, name: string): HTMLElement {
    return getByRole(root, "group", { name });
  }

  function rows(group: HTMLElement): HTMLElement[] {
    return getAllByRole(group, "button");
  }

  function rowNames(group: HTMLElement): string[] {
    return rows(group).map((r) => r.getAttribute("aria-label") ?? "");
  }

  function current(group: HTMLElement): string[] {
    return rows(group)
      .filter((r) => r.getAttribute("aria-current") === "true")
      .map((r) => r.getAttribute("aria-label") ?? "");
  }

  async function open(app: Parameters<typeof settle>[0], root: HTMLElement, name: string): Promise<void> {
    fireEvent.click(getByRole(trail(root), "button", { name }));
    await settle(app);
  }

  /** The circle's pieces at Alt forbrug, named as a list row names them: without the share. */
  async function circlePieces(hash: string): Promise<string[]> {
    const { root } = await mount(hash);
    const circle = getByRole(root, "region", { name: da.mainGroups });
    const loose = queryByRole(circle, "group", { name: da.noPiece });
    const names = getAllByRole(circle, "button")
      .filter((b) => loose === null || !loose.contains(b))
      .map((b) => (b.getAttribute("aria-label") ?? "").replace(/, [^,]*%$/, ""));
    unmount();
    return names;
  }

  it("lists the circle's main groups with their sums, the chosen one current", async () => {
    const pieces = await circlePieces("");
    const { app, root } = await mount("group=Mad");
    const step = getByRole(trail(root), "button", { name: da.switchMainGroup("Mad") });
    expect(step.getAttribute("aria-expanded")).toBe("false");
    await open(app, root, da.switchMainGroup("Mad"));
    expect(step.getAttribute("aria-expanded")).toBe("true");
    const group = list(root, da.mainGroups);
    expect(rowNames(group)).toEqual(pieces);
    expect(rowNames(group)).toEqual([
      partLabel("Bolig", BOLIG, null),
      partLabel("Mad", MAD, null),
      partLabel("Bil", BIL, null),
      partLabel(da.noMainGroup, NONE, null),
    ]);
    expect(current(group)).toEqual([partLabel("Mad", MAD, null)]);
  });

  it("switching the main group drops the category and pushes", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    const push = vi.spyOn(history, "pushState");
    await open(app, root, da.switchMainGroup("Mad"));
    fireEvent.click(getByRole(list(root, da.mainGroups), "button", { name: partLabel("Bolig", BOLIG, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Bolig");
    expect(push).toHaveBeenCalledTimes(1);
    expect(queryByRole(root, "group", { name: da.mainGroups })).toBeNull();
    expectHeading(root, "Bolig");
  });

  it("choosing the current main group keeps the category and adds no history entry", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    const push = vi.spyOn(history, "pushState");
    const replace = vi.spyOn(history, "replaceState");
    await open(app, root, da.switchMainGroup("Mad"));
    fireEvent.click(getByRole(list(root, da.mainGroups), "button", { name: partLabel("Mad", MAD, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Mad&category=Caf%C3%A9");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(queryByRole(root, "group", { name: da.mainGroups })).toBeNull();
  });

  it("switching the category keeps the main group", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    await open(app, root, da.switchCategory("Café"));
    const group = list(root, da.categories);
    expect(rowNames(group)).toEqual([partLabel("Dagligvarer", DAGLIGVARER, null), partLabel("Café", CAFE, null)]);
    expect(current(group)).toEqual([partLabel("Café", CAFE, null)]);
    fireEvent.click(within(group).getByRole("button", { name: partLabel("Dagligvarer", DAGLIGVARER, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Mad&category=Dagligvarer");
    expectHeading(root, "Dagligvarer");
  });

  it("lists the sums of the chosen unit, and the chosen main group even with no piece", async () => {
    const { app, root } = await mount("unit=2026-02-01&group=Bil");
    await open(app, root, da.switchMainGroup("Bil"));
    const group = list(root, da.mainGroups);
    expect(rowNames(group)).toEqual([
      partLabel("Bolig", 800000, null),
      partLabel("Mad", 300000, null),
      partLabel(da.noMainGroup, 15000, null),
      partLabel("Bil", 0, null),
    ]);
    expect(current(group)).toEqual([partLabel("Bil", 0, null)]);
  });

  it("the dashed button chooses a main group, then offers a category", async () => {
    const { app, root } = await mount("");
    const dashed = getByRole(trail(root), "button", { name: da.chooseMainGroup });
    expect(dashed.textContent?.trim()).toBe(da.mainGroupStep);
    await open(app, root, da.chooseMainGroup);
    const group = list(root, da.mainGroups);
    expect(current(group)).toEqual([]);
    fireEvent.click(within(group).getByRole("button", { name: partLabel("Mad", MAD, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Mad");
    const next = getByRole(trail(root), "button", { name: da.chooseCategory });
    expect(next.textContent?.trim()).toBe(da.categoryStep);
    await open(app, root, da.chooseCategory);
    fireEvent.click(within(list(root, da.categories)).getByRole("button", { name: partLabel("Café", CAFE, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Mad&category=Caf%C3%A9");
    expect(queryByRole(trail(root), "button", { name: da.chooseCategory })).toBeNull();
  });

  it("the dashed button chooses a main group in full screen", async () => {
    const { app, root } = await mount("view=full");
    expect(queryByRole(root, "region", { name: da.mainGroups })).toBeNull();
    await open(app, root, da.chooseMainGroup);
    fireEvent.click(within(list(root, da.mainGroups)).getByRole("button", { name: partLabel("Bolig", BOLIG, null) }));
    await settle(app);
    expect(location.hash).toBe("#group=Bolig&view=full");
    expect(getByRole(root, "button", { name: da.fullScreen }).getAttribute("aria-pressed")).toBe("true");
    expectHeading(root, "Bolig");
  });

  it("Escape closes the list and returns the focus to its button", async () => {
    const { app, root } = await mount("group=Mad");
    await open(app, root, da.switchMainGroup("Mad"));
    fireEvent.keyDown(list(root, da.mainGroups), { key: "Escape" });
    await settle(app);
    expect(queryByRole(root, "group", { name: da.mainGroups })).toBeNull();
    expect(app.shadowRoot!.activeElement).toBe(getByRole(trail(root), "button", { name: da.switchMainGroup("Mad") }));
  });
});
