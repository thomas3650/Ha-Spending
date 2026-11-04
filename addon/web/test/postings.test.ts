import { type ClassifiedPosting, type Grouping, type Period, type SpendingData, unitsOf } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryAllByRole, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/components/postings";
import { count, postingAmount, tableDate, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { groupedPostings, linkBase, type PostingList, postingHref, postingList } from "../src/model/postings";
import { DEFAULT_STATE, type Sort, type ViewState } from "../src/state/view";
import type { SpendingApp } from "../src/app";
import { answerFor, LINK } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

const THIS_YEAR = { start: "2026-01-01", end: "2026-10-30" };
const TODAY = "2026-10-30";
const COLOURS = new Map<string | null, string>([
  ["Café", "#eb6834"],
  ["Dagligvarer", "#2a78d6"],
]);

function listOf(state: Partial<ViewState> = {}, data: SpendingData = answerFor(THIS_YEAR)): PostingList {
  const ctx = viewContext(data, { ...DEFAULT_STATE, ...state }, TODAY);
  return groupedPostings(ctx.shown, ctx.units, ctx, true, COLOURS);
}

/** Weeks give more groups than the list shows at once; the page itself never groups by week. */
function weekList(newestFirst = true): PostingList {
  const base = viewContext(answerFor(THIS_YEAR), DEFAULT_STATE, TODAY);
  const ctx = { ...base, timeline: { ...base.timeline, grouping: "week" as const }, units: unitsOf(THIS_YEAR, "week", TODAY) };
  return groupedPostings(ctx.shown, ctx.units, ctx, newestFirst, COLOURS);
}

async function render(
  list: PostingList,
  opts: { showCategory?: boolean; showAccount?: boolean; grouping?: Grouping } = {},
) {
  const el = document.createElement("hs-postings");
  el.list = list;
  el.showCategory = opts.showCategory ?? false;
  if (opts.showAccount !== undefined) el.showAccount = opts.showAccount;
  el.grouping = opts.grouping ?? "month";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function groupButtons(el: HTMLElement): HTMLElement[] {
  return getAllByRole(el, "button").filter((b) => b.hasAttribute("aria-expanded"));
}

function monthUnit(fullStart: string) {
  const ctx = viewContext(answerFor(THIS_YEAR), DEFAULT_STATE, TODAY);
  const unit = ctx.units.find((u) => u.fullStart === fullStart);
  if (!unit) throw new Error(`no unit ${fullStart}`);
  return unit;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the postings list", () => {
  it("groups by unit, newest first, the two newest open", async () => {
    const el = await render(listOf());
    const buttons = groupButtons(el);
    const names = ["10", "09", "08", "07", "06", "05", "04", "03", "02", "01"].map((m) =>
      unitName(monthUnit(`2026-${m}-01`), "month"),
    );
    expect(buttons).toEqual(names.map((n) => getByRole(el, "button", { name: new RegExp(`^${n},`) })));
    const oct = monthUnit("2026-10-01");
    expect(buttons[0]).toBe(
      getByRole(el, "button", { name: `${unitName(oct, "month")}, ${count(3)}, ${postingAmount(1131012)}` }),
    );
    expect(buttons.map((b) => b.getAttribute("aria-expanded")).slice(0, 3)).toEqual(["true", "true", "false"]);
  });

  it("adds a group up to its bar, newest posting first", async () => {
    const el = await render(listOf());
    const sep = monthUnit("2026-09-01");
    const button = getByRole(el, "button", {
      name: `${unitName(sep, "month")}, ${count(4)}, ${postingAmount(1150000)}`,
    });
    const group = button.closest("tbody") as HTMLElement;
    const amounts = getAllByRole(group, "row")
      .slice(1)
      .map((row) => getAllByRole(row, "cell").at(-1)?.textContent?.trim());
    expect(amounts).toEqual([20000, -70000, -300000, -800000].map((ore) => postingAmount(-ore)));
    const dates = getAllByRole(group, "row")
      .slice(1)
      .map((row) => getAllByRole(row, "cell")[0].textContent?.trim());
    expect(dates).toEqual(["2026-09-22", "2026-09-20", "2026-09-10", "2026-09-01"].map(tableDate));
  });

  it("folds a group in and out", async () => {
    const el = await render(listOf());
    const aug = monthUnit("2026-08-01");
    const button = getByRole(el, "button", { name: new RegExp(`^${unitName(aug, "month")},`) });
    expect(queryByRole(el, "cell", { name: tableDate("2026-08-10") })).toBeNull();
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("true");
    getByRole(el, "cell", { name: tableDate("2026-08-10") });
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(queryByRole(el, "cell", { name: tableDate("2026-08-10") })).toBeNull();
  });

  it("shows older groups", async () => {
    const el = await render(weekList(), { grouping: "week" });
    expect(groupButtons(el)).toHaveLength(12);
    fireEvent.click(getByRole(el, "button", { name: da.showOlder }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(24);
  });

  it("shows newer groups when oldest first", async () => {
    const el = await render(weekList(false), { grouping: "week" });
    expect(groupButtons(el)).toHaveLength(12);
    expect(queryByRole(el, "button", { name: da.showOlder })).toBeNull();
    fireEvent.click(getByRole(el, "button", { name: da.showNewer }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(24);
  });

  it("shows 100 rows of a flat list, then more", async () => {
    const grouped = listOf();
    if (grouped.kind !== "grouped") throw new Error("grouped expected");
    const rows = grouped.groups.flatMap((g) => g.rows);
    const many = Array.from({ length: 5 }, () => rows).flat();
    const el = await render({ kind: "flat", rows: many });
    expect(getAllByRole(el, "row")).toHaveLength(101);
    fireEvent.click(getByRole(el, "button", { name: da.showMore }));
    await el.updateComplete;
    expect(getAllByRole(el, "row")).toHaveLength(Math.min(many.length, 200) + 1);
  });

  it("shows each posting's name as a button that opens its detail, with no link to Firefly III", async () => {
    const el = await render(listOf());
    const opened: unknown[] = [];
    el.addEventListener("detail-open", (e) => opened.push((e as CustomEvent).detail));
    const button = getByRole(el, "button", { name: "Café Søde" });
    fireEvent.click(button);
    expect(opened).toEqual([{ kind: "posting", id: "p26" }]);
    expect(queryAllByRole(el, "link")).toEqual([]);
  });

  it("builds the posting's Firefly III address, and only on http and https", () => {
    const p = answerFor(THIS_YEAR).postings[0];
    expect(postingHref(LINK, { ...p, groupId: "a/b c" })).toBe(`${LINK}/transactions/show/a%2Fb%20c`);
    expect(postingHref(null, p)).toBeNull();
    expect(linkBase("javascript:alert(1)")).toBeNull();
    expect(linkBase("ftp://x.test")).toBeNull();
    expect(linkBase("not a url")).toBeNull();
    expect(linkBase(null)).toBeNull();
    expect(linkBase("https://firefly.test")).toBe("https://firefly.test");
    expect(linkBase("http://firefly.test/sub")).toBe("http://firefly.test/sub");
  });

  it("shows the shop, with the bank text as its title", async () => {
    const el = await render(listOf());
    getAllByRole(el, "cell", { name: "Netto", description: "DK NETTO 4521" });
  });

  it("shows the bank text of a posting with no shop, with its full text as its title", async () => {
    const el = await render(listOf());
    getAllByRole(el, "cell", { name: "Husleje", description: "Husleje" });
  });

  it("shows the Konto column unless told not to, and the group line spans the columns shown", async () => {
    const shown = await render(listOf());
    getByRole(shown, "columnheader", { name: da.columns.account });
    getAllByRole(shown, "cell", { name: "Fælleskonto" });
    document.body.replaceChildren();
    const hidden = await render(listOf(), { showCategory: true, showAccount: false });
    expect(queryByRole(hidden, "columnheader", { name: da.columns.account })).toBeNull();
    expect(queryAllByRole(hidden, "cell", { name: "Fælleskonto" })).toEqual([]);
    const columns = getAllByRole(hidden, "columnheader").length;
    expect(columns).toBe(4);
    expect(getAllByRole(hidden, "rowheader")[0].getAttribute("colspan")).toBe(String(columns));
  });

  it("names the text column for the shop and the text", async () => {
    const el = await render(listOf());
    getByRole(el, "columnheader", { name: da.columns.text });
    expect(da.columns.text).toBe("Butik / tekst");
  });

  it("shows the category with its dot", async () => {
    const plain = await render(listOf());
    expect(queryByRole(plain, "columnheader", { name: da.columns.category })).toBeNull();
    document.body.replaceChildren();
    const el = await render(listOf(), { showCategory: true });
    getByRole(el, "columnheader", { name: da.columns.category });
    getByRole(el, "columnheader", { name: da.columns.unitAndDate("month") });
    expect(getAllByRole(el, "cell", { name: "Café" }).length).toBeGreaterThan(0);
  });

  it("starts over when the first group changes", async () => {
    const el = await render(listOf());
    const sep = monthUnit("2026-09-01");
    const button = getByRole(el, "button", { name: new RegExp(`^${unitName(sep, "month")},`) });
    fireEvent.click(button);
    await el.updateComplete;
    expect(button.getAttribute("aria-expanded")).toBe("false");

    el.list = listOf({ period: { preset: "custom", start: "2026-01-01", end: "2026-09-30" } });
    await el.updateComplete;
    const buttons = groupButtons(el);
    expect(buttons[0]).toBe(getByRole(el, "button", { name: new RegExp(`^${unitName(sep, "month")},`) }));
    expect(buttons.map((b) => b.getAttribute("aria-expanded")).slice(0, 3)).toEqual(["true", "true", "false"]);
  });

  it("starts over when the search changes", async () => {
    const full = weekList();
    if (full.kind !== "grouped") throw new Error("expected a grouped list");
    const first = { ...full, groups: full.groups.slice(0, 14) };
    const second = { ...full, groups: [full.groups[0], ...full.groups.slice(2, 15)] };
    const el = await render(first, { grouping: "week" });
    fireEvent.click(groupButtons(el)[2]);
    fireEvent.click(getByRole(el, "button", { name: da.showOlder }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(14);

    el.query = "x";
    el.list = second;
    await el.updateComplete;
    expect(groupButtons(el).map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "true",
      "true",
      ...Array<string>(10).fill("false"),
    ]);
  });

  it("starts over when the shop changes", async () => {
    const full = weekList();
    if (full.kind !== "grouped") throw new Error("expected a grouped list");
    const first = { ...full, groups: full.groups.slice(0, 14) };
    const second = { ...full, groups: [full.groups[0], ...full.groups.slice(2, 15)] };
    const el = await render(first, { grouping: "week" });
    fireEvent.click(groupButtons(el)[2]);
    fireEvent.click(getByRole(el, "button", { name: da.showOlder }));
    await el.updateComplete;
    expect(groupButtons(el)).toHaveLength(14);

    el.shop = "Netto";
    el.list = second;
    await el.updateComplete;
    expect(groupButtons(el).map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "true",
      "true",
      ...Array<string>(10).fill("false"),
    ]);
  });

  describe("the object-group mark", () => {
    const sep20 = tableDate("2026-09-20");
    const sep22 = tableDate("2026-09-22");

    function rowOf(el: HTMLElement, date: string, name = "Pizzeria Roma"): HTMLElement {
      const row = getAllByRole(el, "row").find(
        (r) => queryByRole(r, "cell", { name: date }) && queryByRole(r, "button", { name }),
      );
      if (!row) throw new Error(`no row ${date} ${name}`);
      return row;
    }

    async function openAll(el: HTMLElement) {
      for (const b of groupButtons(el)) {
        if (b.getAttribute("aria-expanded") === "false") fireEvent.click(b);
      }
      await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    }

    it("marks a posting linked to a bill", async () => {
      const el = await render(listOf());
      const row = rowOf(el, sep20);
      expect(row.textContent).toContain("Abonnementer");
      expect(row.textContent).toContain("Pizzaabonnement");
      expect(queryByRole(row, "cell", { name: /^Pizzeria Roma\s+Abonnementer\s*,\s*Pizzaabonnement$/ })).not.toBeNull();
    });

    it("keeps the posting's name as its button's name", async () => {
      const el = await render(listOf());
      getByRole(rowOf(el, sep20), "button", { name: "Pizzeria Roma" });
    });

    it("does not mark an unlinked posting", async () => {
      const el = await render(listOf());
      expect(rowOf(el, sep22).textContent).not.toContain("Abonnementer");
    });

    it("marks it at another grouping", async () => {
      const answer = (range: Period) => json({ ...answerFor(range), earliestPostingDate: "2024-03-01" });
      const { root } = await mount("period=all&card=postings", { answer });
      try {
        const card = getByRole(root, "region", { name: da.postingsTitle });
        const groups = groupButtons(card).map((b) => b.textContent?.trim() ?? "");
        expect(groups.length).toBeGreaterThan(0);
        for (const group of groups) expect(group).toMatch(/^\d{4}\s/);
        expect(rowOf(card, sep20).textContent).toContain("Abonnementer");
      } finally {
        unmount();
      }
    });

    it("marks it in a search's matches", async () => {
      const el = await render(listOf({ search: "pizzeria" }));
      await openAll(el);
      expect(rowOf(el, sep20).textContent).toContain("Pizzaabonnement");
      expect(rowOf(el, sep22).textContent).not.toContain("Abonnementer");
    });
  });
});

describe("sorting the postings by their headers", () => {
  afterEach(unmount);

  const CARD = "card=postings";

  function table(root: HTMLElement): HTMLElement {
    return getByRole(root, "table");
  }

  function headers(root: HTMLElement): HTMLElement[] {
    return getAllByRole(getAllByRole(table(root), "row")[0], "columnheader");
  }

  function header(root: HTMLElement, name: string): HTMLElement {
    return getByRole(getAllByRole(table(root), "row")[0], "columnheader", { name });
  }

  function rows(root: HTMLElement): HTMLElement[] {
    return getAllByRole(table(root), "row")
      .slice(1)
      .filter((r) => queryByRole(r, "rowheader") === null);
  }

  function amounts(root: HTMLElement): (string | undefined)[] {
    return rows(root).map((r) => getAllByRole(r, "cell").at(-1)?.textContent?.trim());
  }

  function texts(root: HTMLElement): (string | undefined)[] {
    return rows(root).map((r) => getByRole(r, "button").textContent?.trim());
  }

  function distinct(values: (string | undefined)[]): (string | undefined)[] {
    return values.filter((v, i) => v !== values[i - 1]);
  }

  async function sortBy(app: SpendingApp, root: HTMLElement, name: string): Promise<void> {
    fireEvent.click(getByRole(header(root, name), "button", { name }));
    await settle(app);
  }

  it("every header is a button and the date is sorted, newest first", async () => {
    const { root } = await mount(CARD);
    const all = headers(root);
    expect(all.map((h) => getByRole(h, "button").textContent?.replace(/[▼▲]/g, "").trim())).toEqual([
      da.columns.unitAndDate("month"),
      da.columns.text,
      da.columns.account,
      da.columns.amount,
    ]);
    expect(all.map((h) => h.getAttribute("aria-sort"))).toEqual(["descending", null, null, null]);
    getByRole(all[0], "button", { name: da.columns.unitAndDate("month") });
  });

  it("Beløb sorts one flat list, largest first, and again smallest first", async () => {
    const { app, root } = await mount(CARD);
    await sortBy(app, root, da.columns.amount);
    expect(queryAllByRole(table(root), "rowheader")).toEqual([]);
    expect(amounts(root)[0]).toBe(postingAmount(800000));
    expect(getAllByRole(rows(root)[0], "cell")[0].textContent?.trim()).toBe(tableDate("2026-10-01"));
    expect(header(root, da.columns.amount).getAttribute("aria-sort")).toBe("ascending");
    expect(header(root, da.columns.unitAndDate("month")).hasAttribute("aria-sort")).toBe(false);

    await sortBy(app, root, da.columns.amount);
    expect(amounts(root)[0]).toBe(postingAmount(-20000));
    expect(amounts(root).at(-1)).toBe(postingAmount(800000));
    expect(header(root, da.columns.amount).getAttribute("aria-sort")).toBe("descending");
  });

  it("the date gives the groups back", async () => {
    const { app, root } = await mount(CARD);
    await sortBy(app, root, da.columns.amount);
    await sortBy(app, root, da.columns.unitAndDate("month"));
    expect(queryAllByRole(table(root), "rowheader").length).toBeGreaterThan(0);
    expect(header(root, da.columns.unitAndDate("month")).getAttribute("aria-sort")).toBe("descending");
    expect(header(root, da.columns.amount).hasAttribute("aria-sort")).toBe(false);
  });

  it("Butik / tekst sorts by the shop, or the text without one, A to Å", async () => {
    const { app, root } = await mount(CARD);
    await sortBy(app, root, da.columns.text);
    const order = [
      "Boghandlen",
      "Café Søde",
      "Husleje",
      "Kiosken",
      "Netto",
      "Pizzeria Roma",
      "Q8",
      "Shell",
    ];
    expect(distinct(texts(root))).toEqual(order);
    expect(header(root, da.columns.text).getAttribute("aria-sort")).toBe("ascending");

    await sortBy(app, root, da.columns.text);
    expect(distinct(texts(root))).toEqual([...order].reverse());
    expect(header(root, da.columns.text).getAttribute("aria-sort")).toBe("descending");
  });

  it("Uden kategori sorts last both ways", async () => {
    const { app, root } = await mount("card=postings&view=full");
    const category = (r: HTMLElement) => getAllByRole(r, "cell")[2].textContent?.trim();
    await sortBy(app, root, da.columns.category);
    expect(distinct(rows(root).map(category))).toEqual([
      "Brændstof",
      "Café",
      "Dagligvarer",
      "Gaver",
      "Husleje",
      da.noCategory,
    ]);
    await sortBy(app, root, da.columns.category);
    expect(distinct(rows(root).map(category))).toEqual([
      "Husleje",
      "Gaver",
      "Dagligvarer",
      "Café",
      "Brændstof",
      da.noCategory,
    ]);
  });

  it("the card's sort survives Søjler and back", async () => {
    const { app, root } = await mount(CARD);
    await sortBy(app, root, da.columns.amount);
    const views = getByRole(root, "group", { name: da.view });
    fireEvent.click(getByRole(views, "button", { name: da.bars }));
    await settle(app);
    expect(queryByRole(root, "table")).toBeNull();
    fireEvent.click(getByRole(views, "button", { name: da.postings }));
    await settle(app);
    expect(header(root, da.columns.amount).getAttribute("aria-sort")).toBe("ascending");
    expect(amounts(root)[0]).toBe(postingAmount(800000));

    const first = getByRole(root, "group", { name: da.spendingInPeriod });
    fireEvent.click(getByRole(first, "link", { name: /→$/ }));
    await settle(app);
    getByRole(root, "button", { name: da.fullScreen, pressed: true });
    expect(header(root, da.columns.amount).getAttribute("aria-sort")).toBe("ascending");
    expect(amounts(root)[0]).toBe(postingAmount(800000));
  });

  it("the card's sort is not in the hash", async () => {
    const { app, root } = await mount(CARD);
    const push = vi.spyOn(history, "pushState");
    const before = location.hash;
    await sortBy(app, root, da.columns.amount);
    expect(location.hash).toBe(before);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("the flat list's order", () => {
  const TODAY_DATA = answerFor(THIS_YEAR);

  function posting(id: string, date: string, amount: number): ClassifiedPosting {
    return {
      id,
      groupId: id,
      date,
      text: id,
      account: "1",
      category: null,
      shop: null,
      kind: "spending",
      amount,
      subscription: null,
      mainGroup: null,
    };
  }

  function flatIds(ps: ClassifiedPosting[], sort: Sort): string[] {
    const ctx = viewContext({ ...TODAY_DATA, postings: ps }, DEFAULT_STATE, TODAY);
    const list = postingList(ps, [], ctx, sort, new Map());
    if (list.kind !== "flat") throw new Error("flat expected");
    return list.rows.map((r) => r.posting.shop ?? r.posting.text);
  }

  it("sorts by a column, ties by the newest date then id", () => {
    const ps = [posting("b", "2026-02-01", 100), posting("a", "2026-02-01", 300), posting("c", "2026-03-01", 100)];
    expect(flatIds(ps, { column: "amount", descending: true })).toEqual(["a", "c", "b"]);
    expect(flatIds(ps, { column: "amount", descending: false })).toEqual(["c", "b", "a"]);
  });

  it("sorts the text the Danish way, A to Å", () => {
    const ps = [
      { ...posting("1", "2026-02-01", 100), shop: "Åbutik" },
      { ...posting("2", "2026-02-01", 100), shop: "Ærø Kro" },
      { ...posting("3", "2026-02-01", 100), shop: "Zoo" },
      { ...posting("4", "2026-02-01", 100), text: "Bank" },
    ];
    expect(flatIds(ps, { column: "text", descending: false })).toEqual(["Bank", "Zoo", "Ærø Kro", "Åbutik"]);
  });
});
