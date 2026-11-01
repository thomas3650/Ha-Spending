import { type ClassifiedPosting, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { amountChip, count, kr, postingAmount, unitName } from "../src/format";
import type { SpendingApp } from "../src/app";
import { da } from "../src/i18n/da";
import { inAmount, matchesSearch, sortPostings } from "../src/model/filter";
import { mount, settle, unmount } from "./mount";

const TODAY = "2026-10-30";
const CAFE = "group=Mad&category=Caf%C3%A9&view=all-postings";

afterEach(unmount);

function trail(root: HTMLElement): HTMLElement {
  return getByRole(root, "navigation", { name: da.trail });
}

function summary(root: HTMLElement, n: number, sum: number): HTMLElement {
  return getByText(root, da.summary(count(n), kr(sum)));
}

function chip(root: HTMLElement, text: string): HTMLElement {
  return getByRole(root, "button", { name: da.remove(text) });
}

function groupButtons(root: HTMLElement): HTMLElement[] {
  return queryAllByRole(getByRole(root, "table"), "button").filter((b) => b.hasAttribute("aria-expanded"));
}

async function openFilter(app: SpendingApp, root: HTMLElement) {
  fireEvent.click(getByRole(root, "button", { name: da.addFilter }));
  await settle(app);
}

describe("screen 3, all postings", () => {
  it("carries the filters over as chips with the count and sum", async () => {
    const { root } = await mount(CAFE);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    chip(root, da.mainGroupChip("Mad"));
    chip(root, da.categoryChip("Café"));
    summary(root, 4, 131012);
    const links = getAllByRole(trail(root), "link").map((a) => a.textContent?.trim());
    expect(links).toEqual([da.allSpending, "Mad", "Café"]);
    expect(queryByRole(root, "region", { name: da.mainGroups })).toBeNull();
    getByRole(root, "columnheader", { name: da.columns.category });
  });

  it("searches the text without a history entry per key", async () => {
    const { app, root } = await mount(CAFE);
    const replace = vi.spyOn(history, "replaceState");
    const push = vi.spyOn(history, "pushState");
    const box = getByRole(root, "searchbox", { name: da.searchLabel });
    expect(box.getAttribute("placeholder")).toBe(da.search);
    fireEvent.input(box, { target: { value: "roma" } });
    await settle(app);
    summary(root, 2, 50000);
    expect(replace.mock.calls.some((call) => String(call[2]).includes("q=roma"))).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("sorts by size as one flat list", async () => {
    const { root } = await mount(`${CAFE}&sort=largest`);
    expect((getByRole(root, "combobox", { name: da.sort }) as HTMLSelectElement).value).toBe("largest");
    const table = getByRole(root, "table");
    expect(groupButtons(root)).toEqual([]);
    const rows = getAllByRole(table, "row").slice(1);
    const seen = rows.map((row) => [
      getByRole(row, "link").textContent?.trim(),
      getAllByRole(row, "cell").at(-1)?.textContent?.trim(),
    ]);
    expect(seen).toEqual([
      ["Pizzeria Roma", postingAmount(70000)],
      ["Café Søde", postingAmount(50000)],
      ["Café Søde", postingAmount(31012)],
      ["Pizzeria Roma", postingAmount(-20000)],
    ]);
  });

  it("pushes a new sort from the select", async () => {
    const { app, root } = await mount(CAFE);
    const push = vi.spyOn(history, "pushState");
    const select = getByRole(root, "combobox", { name: da.sort }) as HTMLSelectElement;
    select.value = "smallest";
    fireEvent.change(select);
    await settle(app);
    expect(push).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(location.hash.slice(1)).get("sort")).toBe("smallest");
    expect(groupButtons(root)).toEqual([]);
  });

  it("sorts oldest first in groups", async () => {
    const first = await mount(`${CAFE}&sort=oldest`);
    const jul = unitAt("2026-07-01", "month", TODAY);
    expect(groupButtons(first.root)[0].getAttribute("aria-label")).toMatch(new RegExp(`^${unitName(jul, "month")},`));
    unmount();

    const { root } = await mount("view=all-postings&sort=oldest&by=day");
    expect(groupButtons(root)).toHaveLength(12);
    getByRole(root, "button", { name: da.showNewer });
  });

  it("removes the main group and its category (D21)", async () => {
    const { app, root } = await mount(CAFE);
    fireEvent.click(chip(root, da.mainGroupChip("Mad")));
    await settle(app);
    expect(queryByRole(root, "button", { name: da.remove(da.categoryChip("Café")) })).toBeNull();
    expect(queryByRole(root, "button", { name: da.remove(da.mainGroupChip("Mad")) })).toBeNull();
    summary(root, 28, 11566012);
    expect(queryByRole(trail(root), "link", { name: "Mad" })).toBeNull();
    getByRole(trail(root), "link", { name: da.allSpending });
  });

  it("removes the category alone with its chip", async () => {
    const { app, root } = await mount(CAFE);
    fireEvent.click(chip(root, da.categoryChip("Café")));
    await settle(app);
    chip(root, da.mainGroupChip("Mad"));
    summary(root, 14, 3281012);
  });

  it("shows the chosen unit as a chip that removes it", async () => {
    const { app, root } = await mount(`${CAFE}&unit=2026-09-01`);
    const sep = unitAt("2026-09-01", "month", TODAY);
    summary(root, 2, 50000);
    fireEvent.click(chip(root, unitName(sep, "month")));
    await settle(app);
    summary(root, 4, 131012);
  });

  it("adds an amount range through + Filter", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    fireEvent.input(getByRole(part, "spinbutton", { name: da.from }), { target: { value: "400" } });
    fireEvent.input(getByRole(part, "spinbutton", { name: da.to }), { target: { value: "600" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    summary(root, 1, 50000);
    fireEvent.click(chip(root, amountChip({ min: 400, max: 600 })));
    await settle(app);
    summary(root, 4, 131012);
  });

  it("adds a main group through + Filter", async () => {
    const { app, root } = await mount("view=all-postings");
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.mainGroups });
    fireEvent.click(getByRole(part, "button", { name: "Bil" }));
    await settle(app);
    chip(root, da.mainGroupChip("Bil"));
    summary(root, 2, 150000);
  });

  it("adds a category, and Uden kategori, through + Filter", async () => {
    const first = await mount("view=all-postings");
    await openFilter(first.app, first.root);
    fireEvent.click(getByRole(getByRole(first.root, "group", { name: da.categories }), "button", { name: "Husleje" }));
    await settle(first.app);
    chip(first.root, da.mainGroupChip("Bolig"));
    chip(first.root, da.categoryChip("Husleje"));
    summary(first.root, 10, 8000000);
    unmount();

    const { app, root } = await mount("view=all-postings");
    await openFilter(app, root);
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.categories }), "button", { name: da.noCategory }));
    await settle(app);
    chip(root, da.mainGroupChip(da.noMainGroup));
    chip(root, da.categoryChip(da.noCategory));
    summary(root, 1, 15000);
  });

  it("says when nothing passes", async () => {
    const { root } = await mount(`${CAFE}&q=xyz`);
    getByText(root, da.noMatch);
    expect(queryByRole(root, "table")).toBeNull();
  });

  it("keeps the search but not the amount through the trail", async () => {
    const { app, root } = await mount(`${CAFE}&q=pizza&min=400`);
    fireEvent.click(getByRole(trail(root), "link", { name: "Mad" }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: "Mad" });
    const params = new URLSearchParams(location.hash.slice(1));
    expect(params.get("q")).toBe("pizza");
    expect(params.has("min")).toBe(false);
  });

  it("shows a busy card while the answer is on its way", async () => {
    const { root } = await mount(CAFE, { answer: () => new Promise<Response>(() => {}) });
    const card = getByRole(root, "region", { name: da.loading });
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(queryByRole(root, "searchbox")).toBeNull();
  });

  it("closes + Filter when the view changes under it", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    getByRole(root, "group", { name: da.amountFilter });
    history.replaceState(null, "", "#view=all-postings");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle(app);
    expect(queryByRole(root, "group", { name: da.amountFilter })).toBeNull();
    expect(getByRole(root, "button", { name: da.addFilter }).getAttribute("aria-expanded")).toBe("false");
  });

  it("refuses an amount that is not whole kroner", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    fireEvent.input(getByRole(part, "spinbutton", { name: da.from }), { target: { value: "1e3" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    summary(root, 4, 131012);
    expect(new URLSearchParams(location.hash.slice(1)).has("min")).toBe(false);
  });
});

function posting(id: string, date: string, amount: number): ClassifiedPosting {
  return { id, groupId: id, date, text: id, account: "1", category: null, kind: "spending", shop: id, amount, mainGroup: null };
}

describe("the filter rules", () => {
  it("searches case-insensitively, trimmed, and an empty search matches all", () => {
    expect(matchesSearch("Café Søde", "  søde ")).toBe(true);
    expect(matchesSearch("Café Søde", "ROMA")).toBe(false);
    expect(matchesSearch("Café Søde", "   ")).toBe(true);
  });

  it("keeps an amount within the range in whole kroner, both bounds included", () => {
    expect(inAmount(posting("a", "2026-01-01", 40000), { min: 400, max: 600 })).toBe(true);
    expect(inAmount(posting("a", "2026-01-01", 60000), { min: 400, max: 600 })).toBe(true);
    expect(inAmount(posting("a", "2026-01-01", 39999), { min: 400, max: null })).toBe(false);
    expect(inAmount(posting("a", "2026-01-01", 60001), { min: null, max: 600 })).toBe(false);
    expect(inAmount(posting("a", "2026-01-01", -20000), null)).toBe(true);
  });

  it("sorts by date then id, and by amount then the newest date", () => {
    const ps = [posting("b", "2026-02-01", 100), posting("a", "2026-02-01", 300), posting("c", "2026-03-01", 100)];
    const ids = (sorted: ClassifiedPosting[]) => sorted.map((p) => p.id);
    expect(ids(sortPostings(ps, "newest"))).toEqual(["c", "b", "a"]);
    expect(ids(sortPostings(ps, "oldest"))).toEqual(["a", "b", "c"]);
    expect(ids(sortPostings(ps, "largest"))).toEqual(["a", "c", "b"]);
    expect(ids(sortPostings(ps, "smallest"))).toEqual(["c", "b", "a"]);
  });
});
