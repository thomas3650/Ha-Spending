import { share, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getAllByText, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { kr, partLabel, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { mount, settle, unmount } from "./mount";

const TODAY = "2026-10-30";
const TOTAL = 11566012;

afterEach(unmount);

function circleCard(root: HTMLElement): HTMLElement {
  return getByRole(root, "region", { name: da.mainGroups });
}

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function barButtons(region: HTMLElement): HTMLElement[] {
  return getAllByRole(region, "listitem").map((item) => getByRole(item, "button"));
}

describe("screen 1, all spending", () => {
  it("shows every main group in the circle with its amount and share", async () => {
    const { root } = await mount("");
    const card = circleCard(root);
    getByRole(card, "heading", { name: da.mainGroups });
    expect(getAllByText(card, kr(TOTAL))).toHaveLength(2);
    const parts: [string, number][] = [
      ["Bolig", 8000000],
      ["Mad", 3281012],
      ["Bil", 150000],
      [da.noMainGroup, 135000],
    ];
    const names = parts.map(([name, amount]) => partLabel(name, amount, share(amount, TOTAL)));
    expect(getAllByRole(card, "button")).toEqual(names.map((name) => getByRole(card, "button", { name })));
    getByText(card, da.circleHintAll);
  });

  it("opens a main group", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(circleCard(root), "button", { name: new RegExp("^Mad,") }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    expect(location.hash).toBe("#group=Mad");
  });

  it("opens Uden hovedgruppe", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(circleCard(root), "button", { name: new RegExp(`^${da.noMainGroup},`) }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.noMainGroup });
    expect(location.hash).toBe("#group=");
  });

  it("shows the bars per month with the average", async () => {
    const { root } = await mount("");
    const card = getByRole(root, "region", { name: da.per("month") });
    getByRole(card, "heading", { name: da.per("month") });
    expect(barButtons(card)).toHaveLength(10);
    getByText(card, da.average(kr(1159444)));
    getByText(card, da.barsHint("month"));
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("true");
    expect(queryByRole(viewSwitch(root), "button", { name: da.difference })).toBeNull();
  });

  it("switches to the postings and back", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    expect(getByRole(viewSwitch(root), "button", { name: da.postings }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(viewSwitch(root), "button", { name: da.bars }).getAttribute("aria-pressed")).toBe("false");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    const oct = unitAt("2026-10-01", "month", TODAY);
    expect(getByRole(card, "button", { name: new RegExp(`^${unitName(oct, "month")},`) }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(location.hash).toBe("#card=postings");

    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    expect(barButtons(getByRole(root, "region", { name: da.per("month") }))).toHaveLength(10);
    expect(location.hash).toBe("");
  });

  it("reaches all postings", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    fireEvent.click(getByRole(root, "button", { name: da.showAll }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    expect(location.hash).toBe("#card=postings&view=all-postings");
  });

  it("keeps the grouping on the bars", async () => {
    const { app, root } = await mount("");
    const select = getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement;
    select.value = "week";
    fireEvent.change(select);
    await settle(app);
    const card = getByRole(root, "region", { name: da.per("week") });
    getByRole(card, "heading", { name: da.per("week") });
    expect(barButtons(card)).toHaveLength(44);
  });
});
