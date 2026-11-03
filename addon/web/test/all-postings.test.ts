import { type ClassifiedPosting, type Period, type Posting, unitAt } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryAllByRole, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { amountChip, count, kr, postingAmount, tableDate, unitName } from "../src/format";
import type { SpendingApp } from "../src/app";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { inAmount } from "../src/model/filter";
import { postingList } from "../src/model/postings";
import { DEFAULT_STATE, type Sort } from "../src/state/view";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

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

function columnHeader(root: HTMLElement, name: string): HTMLElement {
  return getByRole(getAllByRole(getByRole(root, "table"), "row")[0], "columnheader", { name });
}

async function sortBy(app: SpendingApp, root: HTMLElement, name: string): Promise<void> {
  fireEvent.click(getByRole(columnHeader(root, name), "button", { name }));
  await settle(app);
}

function sortInHash(): string | null {
  return new URLSearchParams(location.hash.slice(1)).get("sort");
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
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    expect(box.getAttribute("placeholder")).toBe(da.search);
    fireEvent.input(box, { target: { value: "roma" } });
    await settle(app);
    summary(root, 2, 50000);
    expect(replace.mock.calls.some((call) => String(call[2]).includes("q=roma"))).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the bank's text under a shop that only the text matched", async () => {
    const { root } = await mount("view=all-postings&q=mobilepay");
    const buttons = getAllByRole(root, "button", { name: "Pizzeria Roma" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button.closest("td")?.textContent).toContain("MOBILEPAY 1234");
  });

  it("shows no bank text under a shop that the search matched", async () => {
    const { root } = await mount("view=all-postings&q=roma");
    for (const button of getAllByRole(root, "button", { name: "Pizzeria Roma" })) {
      expect(button.closest("td")?.textContent).not.toContain("MOBILEPAY");
    }
  });

  it("sorts by size as one flat list", async () => {
    const { root } = await mount(`${CAFE}&sort=largest`);
    expect(columnHeader(root, da.columns.amount).getAttribute("aria-sort")).toBe("descending");
    const table = getByRole(root, "table");
    expect(groupButtons(root)).toEqual([]);
    const rows = getAllByRole(table, "row").slice(1);
    const seen = rows.map((row) => [
      getByRole(row, "button").textContent?.trim(),
      getAllByRole(row, "cell").at(-1)?.textContent?.trim(),
    ]);
    expect(seen).toEqual([
      ["Pizzeria Roma", postingAmount(70000)],
      ["Café Søde", postingAmount(50000)],
      ["Café Søde", postingAmount(31012)],
      ["Pizzeria Roma", postingAmount(-20000)],
    ]);
  });

  it("there is no Sortér dropdown: Gruppér pr. and the search field are the only comboboxes", async () => {
    const { root } = await mount(CAFE);
    expect(getAllByRole(root, "combobox")).toEqual([
      getByRole(root, "combobox", { name: da.groupBy }),
      getByRole(root, "combobox", { name: da.searchLabel }),
    ]);
  });

  it("a header click puts the sort in the hash", async () => {
    const { app, root } = await mount(CAFE);
    const push = vi.spyOn(history, "pushState");
    await sortBy(app, root, da.columns.amount);
    expect(push).toHaveBeenCalledTimes(1);
    expect(sortInHash()).toBe("largest");
    expect(groupButtons(root)).toEqual([]);
    await sortBy(app, root, da.columns.account);
    expect(sortInHash()).toBe("account-asc");
  });

  it("back to the date leaves no sort in the hash", async () => {
    const { app, root } = await mount(CAFE);
    await sortBy(app, root, da.columns.amount);
    await sortBy(app, root, da.columns.unitAndDate("month"));
    expect(sortInHash()).toBeNull();
    expect(groupButtons(root).length).toBeGreaterThan(0);
    expect(columnHeader(root, da.columns.unitAndDate("month")).getAttribute("aria-sort")).toBe("descending");
  });

  it("an old link with sort=smallest sorts by Beløb, smallest first", async () => {
    const { root } = await mount(`${CAFE}&sort=smallest`);
    expect(columnHeader(root, da.columns.amount).getAttribute("aria-sort")).toBe("ascending");
    expect(groupButtons(root)).toEqual([]);
    const amounts = getAllByRole(getByRole(root, "table"), "row")
      .slice(1)
      .map((row) => getAllByRole(row, "cell").at(-1)?.textContent?.trim());
    expect(amounts).toEqual([-20000, 31012, 50000, 70000].map(postingAmount));
  });

  it("a sort keeps what the filters let through", async () => {
    const { app, root } = await mount("view=all-postings&unit=2026-07-01&q=e&min=100&max=5000");
    const links = () =>
      rowNames(root)
        .sort();
    summary(root, 3, 620000);
    const before = links();
    await sortBy(app, root, da.columns.amount);
    expect(links()).toEqual(before);
    expect(before).toEqual(["Boghandlen", "Café Søde", "Netto"]);
    summary(root, 3, 620000);
    expect(sortInHash()).toBe("largest");
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
    fireEvent.input(getByRole(part, "textbox", { name: da.from }), { target: { value: "400" } });
    fireEvent.input(getByRole(part, "textbox", { name: da.to }), { target: { value: "600" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    summary(root, 1, 50000);
    fireEvent.click(chip(root, amountChip({ min: 40000, max: 60000 })));
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

  it("shows a chosen shop from a link as a chip with only its rows", async () => {
    const { root } = await mount("view=all-postings&shop=Netto");
    chip(root, da.shopChip("Netto"));
    summary(root, 10, 3150000);
    const texts = rowNames(root);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((text) => text === "Netto")).toBe(true);
  });

  it("offers only the shops with postings in the amount range", async () => {
    const { app, root } = await mount("view=all-postings&min=1000");
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    box.focus();
    fireEvent.input(box, { target: { value: "o" } });
    await settle(app);
    const list = getByRole(root, "listbox", { name: da.suggestions });
    expect(getAllByRole(list, "option")).toEqual([
      getByRole(list, "option", { name: da.shopOption("Netto", kr(3150000)) }),
      getByRole(list, "option", { name: da.shopOption("Boghandlen", kr(120000)) }),
    ]);
  });

  it("shows a busy card while the answer is on its way", async () => {
    const { root } = await mount(CAFE, { answer: () => new Promise<Response>(() => {}) });
    const card = getByRole(root, "region", { name: da.loading });
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(queryByRole(root, "combobox", { name: da.searchLabel })).toBeNull();
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

  it("says how to write an amount it cannot read, adds nothing and stays open", async () => {
    for (const text of ["1e3", "1,5,0", "1.00", "1,505", "abc"]) {
      const { app, root } = await mount(CAFE);
      await openFilter(app, root);
      const part = getByRole(root, "group", { name: da.amountFilter });
      fireEvent.input(getByRole(part, "textbox", { name: da.from }), { target: { value: text } });
      fireEvent.click(getByRole(part, "button", { name: da.add }));
      await settle(app);
      const field = getByRole(part, "textbox", { name: da.from, description: da.amountInvalid });
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(getByRole(part, "textbox", { name: da.to }).hasAttribute("aria-invalid")).toBe(false);
      expect(getByRole(root, "button", { name: da.addFilter }).getAttribute("aria-expanded")).toBe("true");
      summary(root, 4, 131012);
      expect(queryAllByRole(root, "button", { name: (name) => name.startsWith(da.remove(da.amountFilter)) })).toEqual([]);
      expect(new URLSearchParams(location.hash.slice(1)).has("min")).toBe(false);
      unmount();
    }
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    fireEvent.input(getByRole(part, "textbox", { name: da.to }), { target: { value: "1,505" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    const to = getByRole(part, "textbox", { name: da.to, description: da.amountInvalid });
    expect(to.getAttribute("aria-invalid")).toBe("true");
    expect(getByRole(part, "textbox", { name: da.from }).hasAttribute("aria-invalid")).toBe(false);
    expect(hashParam("max")).toBeNull();
  });

  it("judges a field when it loses the focus, and again only at the next blur once it reads", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    const to = getByRole(part, "textbox", { name: da.to });
    fireEvent.input(to, { target: { value: "abc" } });
    await settle(app);
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.blur(to);
    await settle(app);
    getByRole(part, "textbox", { name: da.to, description: da.amountInvalid });
    expect(to.getAttribute("aria-invalid")).toBe("true");
    fireEvent.input(to, { target: { value: "1" } });
    await settle(app);
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.input(to, { target: { value: "1." } });
    await settle(app);
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.blur(to);
    await settle(app);
    expect(to.getAttribute("aria-invalid")).toBe("true");
  });

  it("swaps Fra and Til when Fra is the greater", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    fireEvent.input(getByRole(part, "textbox", { name: da.from }), { target: { value: "1.000,50" } });
    fireEvent.input(getByRole(part, "textbox", { name: da.to }), { target: { value: "200" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    chip(root, amountChip({ min: 20000, max: 100050 }));
    expect(hashParam("min")).toBe("200");
    expect(hashParam("max")).toBe("1000.50");
  });

  it("takes a Danish amount, drops the message once the field is right, and keeps øre in the hash", async () => {
    const { app, root } = await mount(CAFE);
    await openFilter(app, root);
    const part = getByRole(root, "group", { name: da.amountFilter });
    const to = getByRole(part, "textbox", { name: da.to });
    expect(to.getAttribute("inputmode")).toBe("decimal");
    fireEvent.input(to, { target: { value: "1.00" } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    expect(to.getAttribute("aria-invalid")).toBe("true");
    fireEvent.input(to, { target: { value: "1.000,50" } });
    await settle(app);
    expect(to.hasAttribute("aria-invalid")).toBe(false);
    expect(queryByRole(part, "textbox", { name: da.to, description: da.amountInvalid })).toBeNull();
    fireEvent.input(getByRole(part, "textbox", { name: da.from }), { target: { value: " 0 " } });
    fireEvent.click(getByRole(part, "button", { name: da.add }));
    await settle(app);
    chip(root, amountChip({ min: 0, max: 100050 }));
    expect(hashParam("min")).toBe("0");
    expect(hashParam("max")).toBe("1000.50");
  });
});

const SUBS = "view=all-postings&og=Abonnementer";

function hashParam(name: string): string | null {
  return new URLSearchParams(location.hash.slice(1)).get(name);
}

/** The name of each posting row, read from its button; group lines and the header hold no cells. */
function rowNames(root: HTMLElement): (string | undefined)[] {
  return getAllByRole(getByRole(root, "table"), "row")
    .filter((r) => queryAllByRole(r, "cell").length > 0)
    .map((r) => getByRole(r, "button").textContent?.trim());
}

function objectGroupPart(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.subscriptions });
}

/** Netto of 2026-09-10 in Åbne aftaler and Pizzeria Roma of 2026-09-20 in Abonnementer. */
function twoGroups(range: Period): Response {
  const answer = answerFor(range);
  const link = (p: Posting): Posting["subscription"] => {
    if (p.shop === "Netto" && p.date === "2026-09-10") return { id: "b8", name: "Fitness", objectGroup: "Åbne aftaler" };
    if (p.shop === "Pizzeria Roma" && p.date === "2026-09-20") return { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" };
    return null;
  };
  return json({ ...answer, postings: answer.postings.map((p) => ({ ...p, subscription: link(p) })) });
}

describe("the object group on Alle posteringer", () => {
  it("the object group filters the list, the count and the sum", async () => {
    const { root } = await mount(SUBS);
    chip(root, "Abonnementer");
    summary(root, 1, 70000);
    expect(rowNames(root)).toEqual(["Pizzeria Roma"]);
  });

  it("its chip's ✕ shows all postings", async () => {
    const { app, root } = await mount(SUBS);
    fireEvent.click(chip(root, "Abonnementer"));
    await settle(app);
    summary(root, 28, 11566012);
    expect(queryByRole(root, "button", { name: da.remove("Abonnementer") })).toBeNull();
    expect(hashParam("og")).toBeNull();
    expect(hashParam("view")).toBe("all-postings");
  });

  it("a period change keeps og", async () => {
    const { app, root } = await mount(SUBS);
    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(hashParam("period")).toBe("lastMonth");
    expect(hashParam("og")).toBe("Abonnementer");
    chip(root, "Abonnementer");
    summary(root, 1, 70000);
  });

  it("a level change keeps og", async () => {
    const { app, root } = await mount(SUBS);
    await openFilter(app, root);
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.mainGroups }), "button", { name: "Mad" }));
    await settle(app);
    chip(root, da.mainGroupChip("Mad"));
    chip(root, "Abonnementer");
    summary(root, 1, 70000);
    fireEvent.click(chip(root, da.mainGroupChip("Mad")));
    await settle(app);
    expect(hashParam("group")).toBeNull();
    expect(hashParam("og")).toBe("Abonnementer");
    chip(root, "Abonnementer");
    summary(root, 1, 70000);
  });

  it("the shop suggestions follow the object group", async () => {
    const { app, root } = await mount(SUBS);
    const box = getByRole(root, "combobox", { name: da.searchLabel });
    box.focus();
    fireEvent.input(box, { target: { value: "o" } });
    await settle(app);
    const list = getByRole(root, "listbox", { name: da.suggestions });
    expect(getAllByRole(list, "option")).toEqual([
      getByRole(list, "option", { name: da.shopOption("Pizzeria Roma", kr(70000)) }),
    ]);
  });

  it("+ Filter lists the object groups by name and a choice filters", async () => {
    const { app, root } = await mount("view=all-postings", { answer: twoGroups });
    await openFilter(app, root);
    const names = () => getAllByRole(objectGroupPart(root), "button").map((b) => b.textContent?.trim());
    const pressed = () =>
      getAllByRole(objectGroupPart(root), "button").map((b) => b.getAttribute("aria-pressed"));
    expect(names()).toEqual(["Abonnementer", "Åbne aftaler"]);
    expect(pressed()).toEqual(["false", "false"]);
    fireEvent.click(getByRole(objectGroupPart(root), "button", { name: "Åbne aftaler" }));
    await settle(app);
    expect(hashParam("og")).toBe("Åbne aftaler");
    chip(root, "Åbne aftaler");
    summary(root, 1, 300000);
    expect(rowNames(root)).toEqual(["Netto"]);

    await openFilter(app, root);
    expect(names()).toEqual(["Abonnementer", "Åbne aftaler"]);
    expect(pressed()).toEqual(["false", "true"]);
    const before = location.hash;
    fireEvent.click(getByRole(objectGroupPart(root), "button", { name: "Åbne aftaler" }));
    await settle(app);
    expect(location.hash).toBe(before);
    summary(root, 1, 300000);
  });

  it("an unknown og gives da.noMatch with the chip and its one option", async () => {
    const first = await mount("view=all-postings&period=lastYear");
    await openFilter(first.app, first.root);
    getByRole(first.root, "group", { name: da.amountFilter });
    expect(queryByRole(first.root, "group", { name: da.subscriptions })).toBeNull();
    unmount();

    const { app, root } = await mount("view=all-postings&period=lastYear&og=Ukendt");
    getByText(root, da.noMatch);
    expect(queryByRole(root, "table")).toBeNull();
    chip(root, "Ukendt");
    await openFilter(app, root);
    const options = getAllByRole(objectGroupPart(root), "button");
    expect(options.map((b) => [b.textContent?.trim(), b.getAttribute("aria-pressed")])).toEqual([["Ukendt", "true"]]);
  });
});

function posting(id: string, date: string, amount: number): ClassifiedPosting {
  return { id, groupId: id, date, text: id, account: "1", category: null, kind: "spending", shop: id, amount, subscription: null, mainGroup: null };
}

function contextFor(postings: ClassifiedPosting[]) {
  const data = answerFor({ start: "2026-01-01", end: TODAY });
  return viewContext({ ...data, postings }, DEFAULT_STATE, TODAY);
}

describe("the filter rules", () => {
  it("keeps an amount within the range in øre, both bounds included", () => {
    expect(inAmount(posting("a", "2026-01-01", 40000), { min: 40000, max: 60000 })).toBe(true);
    expect(inAmount(posting("a", "2026-01-01", 60000), { min: 40000, max: 60000 })).toBe(true);
    expect(inAmount(posting("a", "2026-01-01", 39999), { min: 40000, max: null })).toBe(false);
    expect(inAmount(posting("a", "2026-01-01", 60001), { min: null, max: 60000 })).toBe(false);
    expect(inAmount(posting("a", "2026-01-01", -20000), null)).toBe(true);
  });

  it("sorts a flat list by a column, ties by the newest date then id", () => {
    const ps = [posting("b", "2026-02-01", 100), posting("a", "2026-02-01", 300), posting("c", "2026-03-01", 100)];
    const ids = (sort: Sort) => {
      const list = postingList(ps, [], contextFor(ps), sort, new Map());
      if (list.kind !== "flat") throw new Error("flat expected");
      return list.rows.map((r) => r.posting.id);
    };
    expect(ids({ column: "amount", descending: true })).toEqual(["a", "c", "b"]);
    expect(ids({ column: "amount", descending: false })).toEqual(["c", "b", "a"]);
  });

  it("sorts the text the Danish way, A to Å", () => {
    const ps = [
      { ...posting("1", "2026-02-01", 100), shop: "Åbutik" },
      { ...posting("2", "2026-02-01", 100), shop: "Ærø Kro" },
      { ...posting("3", "2026-02-01", 100), shop: "Zoo" },
      { ...posting("4", "2026-02-01", 100), shop: null, text: "Bank" },
    ];
    const list = postingList(ps, [], contextFor(ps), { column: "text", descending: false }, new Map());
    if (list.kind !== "flat") throw new Error("flat expected");
    expect(list.rows.map((r) => r.posting.shop ?? r.posting.text)).toEqual(["Bank", "Zoo", "Ærø Kro", "Åbutik"]);
  });

  it("marks a linked posting on Alle posteringer", async () => {
    const { root } = await mount(`${CAFE}&by=month`);
    const row = getAllByRole(root, "row").find((r) => r.textContent?.includes("Pizzaabonnement"));
    expect(row?.textContent).toContain("Abonnementer");
    expect(getAllByRole(root, "row").filter((r) => r.textContent?.includes("Abonnementer"))).toHaveLength(1);
  });

  it("marks it in the flat list by size", async () => {
    const { root } = await mount(`${CAFE}&sort=largest`);
    const row = getAllByRole(getByRole(root, "table"), "row").find((r) => r.textContent?.includes("Pizzaabonnement"));
    expect(row?.textContent).toContain("Abonnementer");
    expect(getByRole(row as HTMLElement, "button", { name: "Pizzeria Roma" })).toBeTruthy();
  });
});

describe("the detail on Alle posteringer", () => {
  /** The list's row with that date and a button with that name. */
  function rowButton(root: HTMLElement, name: string, date: string): HTMLElement {
    const rows = getAllByRole(root, "row").filter(
      (r) => (r.textContent ?? "").includes(tableDate(date)) && within(r).queryByRole("button", { name }),
    );
    if (rows.length !== 1) throw new Error(`${rows.length} rows with ${name} ${date}`);
    return within(rows[0]).getByRole("button", { name });
  }

  async function click(app: SpendingApp, el: HTMLElement): Promise<void> {
    fireEvent.click(el);
    await settle(app);
  }

  it("a row splits Alle posteringer into the list and the detail, and Luk closes it", async () => {
    const { app, root } = await mount("view=all-postings");
    await click(app, rowButton(root, "Café Søde", "2026-10-26"));
    expect(location.hash).toBe("#view=all-postings&detail=p%3Ap26");
    const d = getByRole(root, "group", { name: "Café Søde" });
    expect(app.shadowRoot?.activeElement).toBe(getByRole(d, "heading", { level: 3 }));
    const row = rowButton(root, "Café Søde", "2026-10-26").closest("tr") as HTMLElement;
    expect(row.getAttribute("aria-current")).toBe("true");
    rowButton(root, "Netto", "2026-10-10");

    await click(app, getByRole(d, "button", { name: da.close }));
    expect(location.hash).toBe("#view=all-postings");
    expect(queryByRole(root, "group", { name: "Café Søde" })).toBeNull();
    expect(app.shadowRoot?.activeElement).toBe(rowButton(root, "Café Søde", "2026-10-26"));
  });

  it("the search and the chips stay while the detail is open", async () => {
    const { app, root } = await mount(CAFE);
    await click(app, rowButton(root, "Café Søde", "2026-10-26"));
    getByRole(root, "group", { name: "Café Søde" });
    getByRole(root, "combobox", { name: da.searchLabel });
    chip(root, da.mainGroupChip("Mad"));
    chip(root, da.categoryChip("Café"));
    getByRole(root, "button", { name: da.addFilter });
    summary(root, 4, 131012);
  });

  it("closing with the row filtered out puts the focus on the page's heading", async () => {
    const { app, root } = await mount("view=all-postings");
    await click(app, rowButton(root, "Café Søde", "2026-10-26"));
    fireEvent.input(getByRole(root, "combobox", { name: da.searchLabel }), { target: { value: "netto" } });
    await settle(app);
    const d = getByRole(root, "group", { name: "Café Søde" });
    expect(queryAllByRole(root, "button", { name: "Café Søde" })).toEqual([]);
    await click(app, getByRole(d, "button", { name: da.close }));
    expect(app.shadowRoot?.activeElement).toBe(getByRole(root, "heading", { level: 1, name: da.allPostings }));
  });
});
