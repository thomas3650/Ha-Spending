import { share, unitAt } from "@ha-spending/shared";
import {
  fireEvent,
  getAllByRole,
  getAllByText,
  getByRole,
  getByText,
  queryByRole,
} from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { comparisonLabel, kr, partLabel, percent, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { partName } from "../src/model/context";
import { mount, settle, unmount } from "./mount";
import { KEEP_NBSP } from "./text";

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

function cafeButton(root: HTMLElement): HTMLElement {
  return getByRole(circleCard(root), "button", { name: new RegExp("^Café,") });
}

function inOrder(card: HTMLElement, names: string[]): HTMLElement[] {
  return names.map((name) => getByRole(card, "button", { name: new RegExp(`^${name},`) }));
}

describe("screen 2, a main group", () => {
  it("shows a main group with its share of all spending", async () => {
    const { root } = await mount("group=Mad");
    getByRole(root, "heading", { level: 1, name: "Mad" });
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
    getByRole(root, "heading", { level: 1, name: "Café" });
    expect(cafeButton(root).getAttribute("aria-pressed")).toBe("true");
    const first = getByRole(root, "group", { name: da.inPeriod("Café") });
    getByText(first, kr(CAFE));
    getByText(first, da.shareOf(percent(share(CAFE, MAD) ?? 0), "Mad"), KEEP_NBSP);
    expect(location.hash).toBe("#group=Mad&category=Caf%C3%A9");
    getByText(circleCard(root), da.chosenHint("Mad"));
    getByRole(root, "region", { name: da.levelPer("Café", "month") });

    fireEvent.click(cafeButton(root));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    expect(location.hash).toBe("#group=Mad");
  });

  it("removes the category with its chip", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    const right = getByRole(root, "region", { name: da.levelPer("Café", "month") });
    fireEvent.click(getByRole(right, "button", { name: da.remove("Café") }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    expect(location.hash).toBe("#group=Mad");
    expect(queryByRole(root, "button", { name: da.remove("Café") })).toBeNull();
  });

  it("titles the postings with the chosen category and keeps the chip", async () => {
    const { root } = await mount("group=Mad&category=Café&card=postings");
    const right = getByRole(root, "region", { name: da.postingsOf("Café") });
    getByRole(right, "button", { name: da.remove("Café") });
  });

  it("shows a category without a comparison base", async () => {
    const { root } = await mount("group=Mad&category=Café");
    const sep = unitAt("2026-09-01", "month", TODAY);
    const aug = unitAt("2026-08-01", "month", TODAY);
    const third = getByRole(root, "group", { name: comparisonLabel(sep, aug, "month") });
    getByText(third, da.none);
    getByText(third, `${da.up} ${kr(50000)}`);
  });

  it("goes back up through the trail", async () => {
    const { app, root } = await mount("group=Mad&category=Café");
    fireEvent.click(getByRole(trail(root), "link", { name: "Mad" }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    fireEvent.click(getByRole(trail(root), "link", { name: da.allSpending }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.allSpending });
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

  it("filters to Uden kategori with its chip", async () => {
    const { app, root } = await mount("group=");
    const button = () => getByRole(circleCard(root), "button", { name: new RegExp(`^${da.noCategory},`) });
    fireEvent.click(button());
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.noCategory });
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("#group=&category=");
    const right = getByRole(root, "region", { name: da.levelPer(da.noCategory, "month") });
    getByRole(right, "button", { name: da.remove(da.noCategory) });
  });

  it("keeps the chosen unit while filtering to a category", async () => {
    const { app, root } = await mount("group=Mad&unit=2026-09-01");
    const sep = unitName(unitAt("2026-09-01", "month", TODAY), "month");
    const card = getByRole(root, "region", { name: da.inUnit(da.categories, sep) });
    fireEvent.click(getByRole(card, "button", { name: new RegExp("^Café,") }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Café" });
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
