import { type Posting, share, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getAllByText, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { count, kr, partLabel, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

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

describe("the search on Posteringer", () => {
  const ALL = 28;

  function searchbox(root: HTMLElement): HTMLInputElement {
    return getByRole(root, "searchbox", { name: da.searchLabel }) as HTMLInputElement;
  }

  async function type(app: SpendingApp, root: HTMLElement, text: string) {
    fireEvent.input(searchbox(root), { target: { value: text } });
    await settle(app);
  }

  function summary(root: HTMLElement, n: number, sum: number): HTMLElement {
    return getByText(root, da.summary(count(n), kr(sum)));
  }

  function postingTexts(card: HTMLElement): string[] {
    return getAllByRole(card, "link").map((a) => a.textContent?.trim() ?? "");
  }

  function keyNumberTexts(root: HTMLElement): string[] {
    return getAllByRole(root, "group")
      .filter((g) => g.getAttribute("aria-label") !== da.view)
      .map((g) => g.textContent?.replace(/\s+/g, " ").trim() ?? "");
  }

  it("filters the rows as you type, with the count and sum, and no history entry per key", async () => {
    const { app, root } = await mount("card=postings");
    const box = searchbox(root);
    expect(box.getAttribute("placeholder")).toBe(da.search);
    summary(root, ALL, TOTAL);
    const replace = vi.spyOn(history, "replaceState");
    const push = vi.spyOn(history, "pushState");
    await type(app, root, "roma");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    expect(postingTexts(card)).toEqual(["Pizzeria Roma", "Pizzeria Roma"]);
    summary(root, 2, 50000);
    expect(new URLSearchParams(location.hash.slice(1)).get("q")).toBe("roma");
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves the key numbers and the circle as they are", async () => {
    const { app, root } = await mount("card=postings");
    const before = keyNumberTexts(root);
    await type(app, root, "roma");
    expect(keyNumberTexts(root)).toEqual(before);
    expect(getAllByText(circleCard(root), kr(TOTAL))).toHaveLength(2);
  });

  it("keeps the text through Søjler and back", async () => {
    const { app, root } = await mount("card=postings");
    await type(app, root, "roma");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.bars }));
    await settle(app);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    expect(searchbox(root).value).toBe("roma");
    summary(root, 2, 50000);
  });

  it("shows only the matching rows from a link", async () => {
    const { root } = await mount("card=postings&q=caf%C3%A9");
    expect(searchbox(root).value).toBe("café");
    expect(postingTexts(getByRole(root, "region", { name: da.postingsTitle }))).toEqual(["Café Søde", "Café Søde"]);
    summary(root, 2, 81012);
  });

  it("says when nothing matches and keeps the focus in the field", async () => {
    const { app, root } = await mount("card=postings");
    const box = searchbox(root);
    box.focus();
    await type(app, root, "romaxyz");
    getByText(root, da.noMatch);
    expect(searchbox(root)).toBe(box);
    expect((app.shadowRoot as ShadowRoot).activeElement).toBe(box);
  });

  it("shows the field above no spending in a unit after today", async () => {
    const { root } = await mount("period=custom&from=2026-10-01&to=2026-12-31&unit=2026-12-01&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    getByRole(card, "button", { name: da.remove(unitName(unitAt("2026-12-01", "month", TODAY), "month")) });
    searchbox(card);
    getByText(card, da.noSpending);
  });

  it("shows the field in a period with no spending at all", async () => {
    const { root } = await mount("period=custom&from=2020-01-01&to=2020-12-31&card=postings");
    const card = getByRole(root, "region", { name: da.postingsTitle });
    searchbox(card);
    getByText(card, da.noSpending);
  });

  it("opens Alle posteringer with the text from its button", async () => {
    const { app, root } = await mount("card=postings");
    await type(app, root, "roma");
    fireEvent.click(getByRole(root, "button", { name: da.showAll }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    expect(searchbox(root).value).toBe("roma");
    summary(root, 2, 50000);
  });

  it("finds Danish capitals from small letters", async () => {
    const beer: Posting = {
      id: "beer",
      groupId: "beer",
      date: "2026-10-20",
      text: "ØL OG VAND",
      account: "1",
      category: "Dagligvarer",
      kind: "spending",
      amount: 12500,
    };
    const answer = (range: { start: string; end: string }) => {
      const data = answerFor(range);
      return json({ ...data, postings: [beer, ...data.postings] });
    };
    const { app, root } = await mount("card=postings", { answer });
    await type(app, root, "øl");
    expect(postingTexts(getByRole(root, "region", { name: da.postingsTitle }))).toEqual(["ØL OG VAND"]);
    summary(root, 1, 12500);
  });

  it("counts everything for a search of spaces", async () => {
    const { app, root } = await mount("card=postings");
    await type(app, root, "   ");
    summary(root, ALL, TOTAL);
  });

  it("holds only the category's matching postings in the chosen unit", async () => {
    const { root } = await mount("group=Mad&category=Caf%C3%A9&unit=2026-07-01&card=postings&q=e");
    const card = getByRole(root, "region", { name: da.postingsOf("Café") });
    expect(postingTexts(card)).toEqual(["Café Søde"]);
    summary(root, 1, 50000);
  });

  it("goes Back past all the keys at once", async () => {
    const { app, root } = await mount("");
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.postings }));
    await settle(app);
    const length = history.length;
    for (const text of ["p", "pi", "piz"]) await type(app, root, text);
    expect(history.length).toBe(length);
    expect(location.hash).toBe("#card=postings&q=piz");
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe(""));
    await settle(app);
    getByRole(root, "region", { name: da.per("month") });
  });
});
