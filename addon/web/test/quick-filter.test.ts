import { fireEvent, getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpendingApp } from "../src/app";
import { kr } from "../src/format";
import { da } from "../src/i18n/da";
import type { AmountFilter } from "../src/model/amount";
import { mount, settle, unmount } from "./mount";
import { plainSummary, showingSummary } from "./summary";

const ALL = 28;
const TOTAL = 11566012;

afterEach(unmount);

function searchbox(root: HTMLElement): HTMLInputElement {
  return getByRole(root, "combobox", { name: da.searchLabel }) as HTMLInputElement;
}

async function type(app: SpendingApp, root: HTMLElement, text: string) {
  fireEvent.input(searchbox(root), { target: { value: text } });
  await settle(app);
}

function ryd(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: da.clearQuick });
}

describe("the sentence over the list", () => {
  it("reads as before without a quick filter, and offers no Ryd", async () => {
    const { root } = await mount("card=postings");
    plainSummary(root, ALL, TOTAL);
  });

  it("names a shop, the text in quotes and an Omkring amount with its ends", async () => {
    const { root } = await mount("card=postings&shop=Pizzeria+Roma&q=1234&about=700");
    const filter: AmountFilter = { kind: "about", value: 70_000 };
    showingSummary(root, 1, ALL, 70_000, ["Pizzeria Roma", da.searchPart("1234"), da.amountWords(filter)].join(" · "));
    expect(da.amountWords(filter)).toContain("(");
  });

  it.each<[string, AmountFilter, number, number]>([
    ["under=4500", { kind: "under", value: 450_000 }, 17, 3_116_012],
    ["over=4500", { kind: "over", value: 450_000 }, 10, 8_000_000],
    ["min=1000&max=2000", { kind: "between", min: 100_000, max: 200_000 }, 1, 120_000],
  ])("says the amount in words for %s", async (query, filter, n, sum) => {
    const { root } = await mount(`card=postings&${query}`);
    showingSummary(root, n, ALL, sum, da.amountWords(filter));
  });

  it("says Viser 0 af … with no sum when nothing matches, and the list says so", async () => {
    const { root } = await mount("card=postings&q=romaxyz");
    showingSummary(root, 0, ALL, 0, da.searchPart("romaxyz"));
    getByText(root, da.noMatch);
    ryd(root);
  });

  it("stays when the tab and the period change", async () => {
    const { app, root } = await mount("card=postings&under=4500");
    const filter: AmountFilter = { kind: "under", value: 450_000 };
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.bars }));
    await settle(app);
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: da.postings }));
    await settle(app);
    expect(location.hash).toBe("#card=postings&under=4500");
    showingSummary(root, 17, ALL, 3_116_012, da.amountWords(filter));
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastYear }));
    await settle(app);
    expect(location.hash).toBe("#period=lastYear&card=postings&under=4500");
    showingSummary(root, 2, 3, 400_000, da.amountWords(filter));
  });
});

describe("Ryd", () => {
  it("clears the search, the shop and the amount in one history entry, and focuses the search", async () => {
    const { app, root } = await mount("card=postings&shop=Pizzeria+Roma&q=1234&under=4500");
    const length = history.length;
    fireEvent.click(ryd(root));
    await settle(app);
    expect(location.hash).toBe("#card=postings");
    expect(history.length).toBe(length + 1);
    expect(searchbox(root).value).toBe("");
    plainSummary(root, ALL, TOTAL);
    expect((app.shadowRoot as ShadowRoot).activeElement).toBe(searchbox(root));
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe("#card=postings&shop=Pizzeria+Roma&q=1234&under=4500"));
    await settle(app);
    getByRole(root, "button", { name: da.remove(da.shopChip("Pizzeria Roma")) });
  });
});

describe("the shop suggestions", () => {
  it("name the count, and ignore the amount", async () => {
    const { app, root } = await mount("card=postings&over=10000");
    getByText(root, da.noMatch);
    searchbox(root).focus();
    await type(app, root, "pizz");
    getByRole(getByRole(root, "listbox", { name: da.suggestions }), "option", {
      name: da.shopOption("Pizzeria Roma", "2", kr(50_000)),
    });
  });
});

describe("Fjern beløb", () => {
  it("pushes one entry, and Back brings the amount back", async () => {
    const { app, root } = await mount("card=postings&under=4500");
    const length = history.length;
    fireEvent.click(getByRole(root, "button", { name: da.removeAmount }));
    await settle(app);
    expect(location.hash).toBe("#card=postings");
    expect(history.length).toBe(length + 1);
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe("#card=postings&under=4500"));
    await settle(app);
    getByRole(root, "group", { name: da.amountName({ kind: "under", value: 450_000 }) });
  });
});

