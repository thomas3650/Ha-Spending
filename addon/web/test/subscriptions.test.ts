import type { Subscription } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { subscriptionRows } from "../src/model/subscriptions";
import { DEFAULT_STATE } from "../src/state/view";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const KEY_LABEL = da.inPeriod("Faste udgifter");

function mountWith(hash: string, subscriptions: Subscription[] = SUBSCRIPTIONS, link: string | null = LINK) {
  return mount(hash, {
    answer: (range) => json({ ...withSubscriptions(answerFor(range), subscriptions), fireflyLinkUrl: link }),
  });
}

function keyNumber(root: HTMLElement): HTMLElement {
  return getByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) });
}

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function card(root: HTMLElement, title: string): HTMLElement {
  return getByRole(root, "region", { name: title });
}

function text(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The name cell read without the object group's pill, which the fixture names Faste udgifter or Abonnementer. */
function nameCell(r: HTMLElement): string {
  return text(within(r).getAllByRole("cell")[0]).replace(/ (Faste udgifter|Abonnementer)/, "");
}

function fixedCostName(r: HTMLElement): string {
  return nameCell(r).replace(/ næste .*$/, "");
}

function rowNames(region: HTMLElement): string[] {
  return getAllByRole(region, "row")
    .slice(1)
    .filter((r) => within(r).queryByRole("rowheader") === null)
    .map(fixedCostName);
}

function groupHeaders(region: HTMLElement): HTMLElement[] {
  return getAllByRole(region, "rowheader");
}

function groupRow(region: HTMLElement, name: string): HTMLElement {
  const header = groupHeaders(region).find((h) => text(h).startsWith(name));
  if (!header) throw new Error(`no group ${name}`);
  return header.closest("tr") as HTMLElement;
}

/** The rowgroup that holds the group's header row and its fixed costs. */
function rowgroupOf(region: HTMLElement, group: string): HTMLElement {
  const row = groupRow(region, group);
  const found = getAllByRole(region, "rowgroup").find((g) => g.contains(row));
  if (!found) throw new Error(`no rowgroup for ${group}`);
  return found;
}

function groupNames(region: HTMLElement): string[] {
  return groupHeaders(region).map((h) => text(h).replace(/ \d+ faste? udgifte?r?$/, ""));
}

function row(region: HTMLElement, name: string): HTMLElement {
  return getByRole(region, "row", { name: new RegExp(`^${name}`) });
}

function categoryColumn(region: HTMLElement): number {
  return getAllByRole(region, "columnheader").findIndex((h) => text(h) === da.subscriptionColumns.category);
}

/** The row's cells without the Kategori column, which has its own helper. */
function cells(region: HTMLElement, name: string): string[] {
  const column = categoryColumn(region);
  return within(row(region, name))
    .getAllByRole("cell")
    .filter((_, i) => i !== column)
    .map((c, i) => (i === 0 ? nameCell(row(region, name)) : text(c)));
}

function categoryOf(region: HTMLElement, name: string): string {
  return text(within(row(region, name)).getAllByRole("cell")[categoryColumn(region)]);
}

describe("the subscriptions key number", () => {
  it("opens the card from the Faste udgifter key number", async () => {
    const { app, root } = await mountWith("");
    const button = keyNumber(root);
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    await settle(app);
    card(root, "Faste udgifter");
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(viewSwitch(root), "button", { name: "Faste udgifter" }).getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("#card=subscriptions");

    fireEvent.click(keyNumber(root));
    await settle(app);
    card(root, da.per("month"));
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("false");
    expect(location.hash).toBe("");
  });

  it("adds Faste udgifter to the switch", async () => {
    const { app, root } = await mountWith("");
    const buttons = getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim());
    expect(buttons).toEqual([da.bars, da.postings, "Faste udgifter", da.shops]);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: "Faste udgifter" }));
    await settle(app);
    card(root, "Faste udgifter");
  });

  it("counts one subscription in the singular", async () => {
    const { root } = await mountWith("card=subscriptions", [SUBSCRIPTIONS[0]]);
    expect(text(groupRow(card(root, "Faste udgifter"), "Bolig"))).toContain(da.subscriptionCount(1));
  });
});

describe("the subscriptions card", () => {
  it("lists every subscription in the order of its status within its group", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(getAllByRole(region, "columnheader").map((h) => h.textContent?.replace(/[▲▼]/g, "").trim())).toEqual([
      "Fast udgift",
      "Kategori",
      "Beløb",
      "Om året",
      "Status",
    ]);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
    expect(cells(region, "Husleje")).toEqual(["Husleje næste 1. nov", "8.000 kr. pr. måned", "96.000 kr.", "Forventes 1. nov"]);
    expect(cells(region, "Streaming").slice(1)).toEqual(["114 kr. pr. måned", "1.368 kr.", "Steget · 129 → 149 kr."]);
    expect(cells(region, "Indboforsikring").slice(1)).toEqual([
      "900 kr. pr. kvartal",
      "3.600 kr.",
      "Ikke set · ventet 5. jul",
    ]);
    expect(cells(region, "Bilforsikring")).toEqual([
      "Bilforsikring næste 1. mar 2027",
      "4.800 kr. om året",
      "4.800 kr.",
      "Betalt 1. mar",
    ]);
    expect(cells(region, "Avis").slice(1)).toEqual(["200 kr. hver 2. måned", "1.200 kr.", "Forventes 20. nov"]);
    getByText(region, da.subscriptionsFoot);
    const box = getByRole(region, "group", { name: "Faste udgifter" });
    expect(box.tabIndex).toBe(0);
    getByRole(box, "table");
  });

  it("shows a main group's subscriptions", async () => {
    const { root } = await mountWith("group=Bolig&card=subscriptions");
    const region = card(root, "Faste udgifter i Bolig");
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje"]);
    expect(groupNames(region)).toEqual(["Husleje"]);
    getByText(region, "99.600 kr. om året");
  });

  it("puts one with no payment, and one whose category is unknown, in Uden hovedgruppe", async () => {
    const unknown: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b9",
      name: "Fitness",
      amountMin: 30000,
      amountMax: 30000,
      lastPayment: { date: "2026-10-01", amount: 30000, category: "Ukendt", account: "1" },
    };
    const all = [...SUBSCRIPTIONS, unknown];
    const { root } = await mountWith(`group=&card=subscriptions`, all);
    const region = card(root, `Faste udgifter i ${da.noMainGroup}`);
    expect(rowNames(region)).toEqual(["Tennisklub", "Fitness", "Avis"]);
    expect(groupNames(region)).toEqual(["Gaver", da.noCategory]);
  });

  it("leaves out those paid from an account not chosen, never one with no payment", async () => {
    const { root } = await mountWith("accounts=1&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter"))).toEqual(["Indboforsikring", "Husleje", "Avis", "Tennisklub"]);
  });

  it("shows a category's subscriptions and its chip", async () => {
    const { root } = await mountWith("group=Mad&category=Café&card=subscriptions");
    const region = card(root, "Faste udgifter i Café");
    expect(rowNames(region)).toEqual(["Streaming"]);
    getByRole(region, "button", { name: da.remove("Café") });
  });

  it("does not follow the search", async () => {
    const { root } = await mountWith("q=Netto&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter"))).toHaveLength(6);
    expect(location.hash).toBe("#q=Netto&card=subscriptions");
  });

  it("does not follow a chosen unit or the period", async () => {
    const { app, root } = await mountWith("unit=2026-07-01&card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(queryByRole(root, "button", { name: da.remove("Juli 2026") })).toBeNull();
    expect(rowNames(region)).toHaveLength(6);
    getByRole(viewSwitch(root), "button", { name: da.difference });

    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter"))).toHaveLength(6);
  });

  it("shows its rows in a period with no postings", async () => {
    const { root } = await mountWith("period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(rowNames(region)).toHaveLength(6);
    expect(within(region).queryByText(da.noSpending)).toBeNull();
  });

  it("shows each name as a button that opens its detail, with no link to Firefly III", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    const opened: unknown[] = [];
    region.addEventListener("detail-open", (e) => opened.push((e as CustomEvent).detail));
    fireEvent.click(getByRole(region, "button", { name: "Husleje" }));
    expect(opened).toEqual([{ kind: "subscription", id: "b1" }]);
    expect(queryByRole(region, "link")).toBeNull();
  });

  it("says when a level has none", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&card=subscriptions");
    const region = card(root, "Faste udgifter i Bil");
    getByText(region, "Ingen faste udgifter i Bil");
    expect(queryByRole(region, "table")).toBeNull();
  });
});

describe("the object groups in the card", () => {
  function sums(region: HTMLElement, title = "Faste udgifter"): string[] {
    return getAllByRole(getByRole(region, "list", { name: title }), "listitem").map(text);
  }

  it("marks each fixed cost with its object group", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(text(row(region, "Streaming"))).toContain("Abonnementer");
    expect(text(row(region, "Husleje"))).toContain("Faste udgifter");
  });

  it("keeps the fixed cost's name as its button's name", async () => {
    const { root } = await mountWith("card=subscriptions");
    getByRole(card(root, "Faste udgifter"), "button", { name: "Husleje" });
  });

  it("shows a yearly sum per object group, biggest first", async () => {
    const { root } = await mountWith("card=subscriptions");
    expect(sums(card(root, "Faste udgifter"))).toEqual([
      "Faste udgifter 105.600 kr. om året",
      "Abonnementer 3.168 kr. om året",
    ]);
  });

  it("has no single sum in the card's head", async () => {
    const { root } = await mountWith("card=subscriptions");
    expect(within(card(root, "Faste udgifter")).queryByText("106.968 kr. om året")).toBeNull();
  });

  it("shows one box at a main group with one object group", async () => {
    const { root } = await mountWith("group=Bolig&card=subscriptions");
    expect(sums(card(root, "Faste udgifter i Bolig"), "Faste udgifter i Bolig")).toEqual(["Faste udgifter 99.600 kr. om året"]);
  });

  it("shows no box when no fixed cost is shown", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&card=subscriptions");
    const region = card(root, "Faste udgifter i Bil");
    expect(text(region)).not.toContain("om året");
  });

  it("drops a box when its bills are on another account", async () => {
    const one = await mountWith("accounts=1&card=subscriptions");
    expect(sums(card(one.root, "Faste udgifter"))).toEqual([
      "Faste udgifter 100.800 kr. om året",
      "Abonnementer 1.800 kr. om året",
    ]);
    unmount();
    const two = await mountWith("accounts=2&card=subscriptions");
    expect(sums(card(two.root, "Faste udgifter"))).toHaveLength(2);
  });
});

describe("the subscriptions card grouped", () => {
  const FITNESS: Subscription = {
    ...SUBSCRIPTIONS[0],
    id: "b9",
    name: "Fitness",
    amountMin: 30000,
    amountMax: 30000,
    lastPayment: { date: "2026-10-01", amount: 30000, category: "Ukendt", account: "1" },
  };

  function tbodyOf(region: HTMLElement, group: string): HTMLElement {
    return rowgroupOf(region, group);
  }

  it("groups by main group at Alt forbrug, the biggest sum per year first, Uden hovedgruppe last", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(groupHeaders(region).map(text)).toEqual([
      "Bolig 2 faste udgifter",
      "Bil 1 fast udgift",
      "Mad 1 fast udgift",
      `${da.noMainGroup} 2 faste udgifter`,
    ]);
    expect(within(groupRow(region, "Bolig")).getAllByRole("cell").map(text)).toEqual(["", "", "99.600 kr.", ""]);
    expect(within(groupRow(region, "Bil")).getAllByRole("cell").map(text)).toEqual(["", "", "4.800 kr.", ""]);
    expect(getAllByRole(region, "columnheader").map(text)).toContain("Kategori");
    expect(tbodyOf(region, "Bolig").contains(row(region, "Husleje"))).toBe(true);
    expect(tbodyOf(region, "Bil").contains(row(region, "Husleje"))).toBe(false);
    expect(tbodyOf(region, "Bil").contains(row(region, "Bilforsikring"))).toBe(true);
    expect(categoryOf(region, "Husleje")).toBe("Husleje");
    expect(categoryOf(region, "Streaming")).toBe("Café");
  });

  it("puts one with no payment and one with an unknown category last, reading Uden kategori", async () => {
    const { root } = await mountWith("card=subscriptions", [...SUBSCRIPTIONS, FITNESS]);
    const region = card(root, "Faste udgifter");
    expect(groupNames(region).at(-1)).toBe(da.noMainGroup);
    const last = tbodyOf(region, da.noMainGroup);
    expect(
      within(last)
        .getAllByRole("row")
        .filter((r) => within(r).queryByRole("rowheader") === null)
        .map(fixedCostName),
    ).toEqual(["Fitness", "Avis", "Tennisklub"]);
    expect(categoryOf(region, "Tennisklub")).toBe("Gaver");
    expect(categoryOf(region, "Avis")).toBe(da.noCategory);
    expect(categoryOf(region, "Fitness")).toBe(da.noCategory);
  });

  it("orders groups with the same sum per year by name", async () => {
    const make = (id: string, name: string, category: string): Subscription => ({
      ...SUBSCRIPTIONS[0],
      id,
      name,
      amountMin: 10000,
      amountMax: 10000,
      lastPayment: { date: "2026-10-01", amount: 10000, category, account: "1" },
    });
    const all = [make("c1", "Ens", "Husleje"), make("c2", "To", "Brændstof"), make("c3", "Tre", "Café")];
    const { root } = await mountWith("card=subscriptions", all);
    expect(groupNames(card(root, "Faste udgifter"))).toEqual(["Bil", "Bolig", "Mad"]);
  });

  it("shows the groups in a period with no postings", async () => {
    const { root } = await mountWith("period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowNames(region)).toHaveLength(6);
  });

  it("groups by category at a main group, with no Kategori column", async () => {
    const { root } = await mountWith("group=Bolig&card=subscriptions");
    const region = card(root, "Faste udgifter i Bolig");
    expect(groupHeaders(region).map(text)).toEqual(["Husleje 2 faste udgifter"]);
    expect(getAllByRole(region, "columnheader").map(text)).not.toContain("Kategori");
    expect(within(groupRow(region, "Husleje")).getAllByRole("cell").map(text)).toEqual(["", "99.600 kr.", ""]);
  });

  it("puts the no-payment and unknown-category ones of Uden hovedgruppe under one Uden kategori, last", async () => {
    const gift: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b8",
      name: "Gavekort",
      lastPayment: { date: "2026-10-01", amount: 800000, category: "Gaver", account: "1" },
    };
    const { root } = await mountWith("group=&card=subscriptions", [...SUBSCRIPTIONS, FITNESS, gift]);
    const region = card(root, `Faste udgifter i ${da.noMainGroup}`);
    expect(groupNames(region)).toEqual(["Gaver", da.noCategory]);
    const none = tbodyOf(region, da.noCategory);
    within(none).getByText("Fitness");
    within(none).getByText("Avis");
  });

  it("has no group rows at a category", async () => {
    const { root } = await mountWith("group=Mad&category=Café&card=subscriptions");
    const region = card(root, "Faste udgifter i Café");
    expect(queryByRole(region, "rowheader")).toBeNull();
    expect(getAllByRole(region, "columnheader").map(text)).not.toContain("Kategori");
    expect(rowNames(region)).toEqual(["Streaming"]);
  });
});

describe("the answer's today", () => {
  it("sets the statuses, not the app's today", () => {
    const data = withSubscriptions(answerFor({ start: "2025-12-01", end: "2026-10-30" }));
    const rows = subscriptionRows(viewContext(data, DEFAULT_STATE, "2026-11-07"));
    const husleje = rows.find((r) => r.name === "Husleje");
    expect(husleje?.status.text).toBe("Forventes 1. nov");
    expect(husleje?.next).toBe("1. nov");
  });
});

describe("with no subscriptions", () => {
  it("shows plain key numbers and no Faste udgifter", async () => {
    const { root } = await mount("card=subscriptions");
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
    expect(queryByRole(root, "button", { name: new RegExp(`^${da.inPeriod("Abonnementer")}`) })).toBeNull();
    getByRole(root, "group", { name: da.inPeriod("Abonnementer") });
    getByRole(root, "group", { name: da.spendingInPeriod });
    expect(queryByRole(viewSwitch(root), "button", { name: "Faste udgifter" })).toBeNull();
    card(root, da.per("month"));
    expect(location.hash).toBe("");
  });

  it("keeps three bones and no fourth number while loading", async () => {
    const { root } = await mount("", { answer: () => new Promise<Response>(() => {}) });
    const busy = getAllByRole(root, "group", { name: da.loading })[0];
    expect(busy.children).toHaveLength(3);
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
  });
});

describe("sorting the subscriptions by their headers", () => {
  const CARD = "card=subscriptions";

  function header(region: HTMLElement, name: string): HTMLElement {
    return getByRole(region, "columnheader", { name });
  }

  async function sortBy(
    app: Parameters<typeof settle>[0],
    root: HTMLElement,
    name: string,
    title = "Faste udgifter",
  ): Promise<void> {
    fireEvent.click(getByRole(header(card(root, title), name), "button", { name }));
    await settle(app);
  }

  /** What a browser does on a new hash: the app hears it. */
  async function go(app: Parameters<typeof settle>[0], hash: string): Promise<void> {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await settle(app);
  }

  function rowsIn(region: HTMLElement, group: string): string[] {
    return getAllByRole(rowgroupOf(region, group), "row")
      .filter((r) => within(r).queryByRole("rowheader") === null)
      .map(fixedCostName);
  }

  const c = da.subscriptionColumns;

  it("starts sorted by Status, ascending", async () => {
    const { root } = await mountWith(CARD);
    const region = card(root, "Faste udgifter");
    expect(header(region, c.status).getAttribute("aria-sort")).toBe("ascending");
    expect(getAllByRole(region, "columnheader").filter((h) => h.hasAttribute("aria-sort"))).toHaveLength(1);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
  });

  it("Om året sorts inside each group, largest first", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    const region = card(root, "Faste udgifter");
    expect(header(region, c.perYear).getAttribute("aria-sort")).toBe("descending");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowsIn(region, "Bolig")).toEqual(["Husleje", "Indboforsikring"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
  });

  it("a second click flips it", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    await sortBy(app, root, c.perYear);
    const region = card(root, "Faste udgifter");
    expect(header(region, c.perYear).getAttribute("aria-sort")).toBe("ascending");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowsIn(region, "Bolig")).toEqual(["Indboforsikring", "Husleje"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Avis", "Tennisklub"]);
  });

  it("Beløb sorts by the amount per payment", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.amount);
    const region = card(root, "Faste udgifter");
    expect(header(region, c.amount).getAttribute("aria-sort")).toBe("descending");
    expect(rowsIn(region, "Bolig")).toEqual(["Husleje", "Indboforsikring"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Avis", "Tennisklub"]);
  });

  it("Fast udgift sorts A to Å", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.name);
    const region = card(root, "Faste udgifter");
    expect(header(region, c.name).getAttribute("aria-sort")).toBe("ascending");
    expect(rowNames(region)).toEqual(["Husleje", "Indboforsikring", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
    await sortBy(app, root, c.name);
    expect(rowNames(card(root, "Faste udgifter"))).toEqual([
      "Indboforsikring",
      "Husleje",
      "Bilforsikring",
      "Streaming",
      "Tennisklub",
      "Avis",
    ]);
  });

  it("sorts one list at a category", async () => {
    const { app, root } = await mountWith("group=Bolig&category=Husleje&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter i Husleje"))).toEqual(["Indboforsikring", "Husleje"]);
    await sortBy(app, root, c.name, "Faste udgifter i Husleje");
    expect(rowNames(card(root, "Faste udgifter i Husleje"))).toEqual(["Husleje", "Indboforsikring"]);
  });

  it("Uden kategori sorts last both ways", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.category);
    const region = card(root, "Faste udgifter");
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
    await sortBy(app, root, c.category);
    expect(header(card(root, "Faste udgifter"), c.category).getAttribute("aria-sort")).toBe("descending");
    expect(rowsIn(card(root, "Faste udgifter"), da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
  });

  it("a Kategori sort gives way to Status where Kategori is not shown, and comes back at Alt forbrug", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.category);
    await go(app, "group=Bolig&card=subscriptions");
    const region = card(root, "Faste udgifter i Bolig");
    expect(header(region, c.status).getAttribute("aria-sort")).toBe("ascending");
    expect(getAllByRole(region, "columnheader").filter((h) => h.hasAttribute("aria-sort"))).toHaveLength(1);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje"]);

    await go(app, CARD);
    expect(header(card(root, "Faste udgifter"), c.category).getAttribute("aria-sort")).toBe("ascending");

    await go(app, "group=Bolig&card=subscriptions");
    await sortBy(app, root, c.status, "Faste udgifter i Bolig");
    expect(header(card(root, "Faste udgifter i Bolig"), c.status).getAttribute("aria-sort")).toBe("descending");
    expect(rowNames(card(root, "Faste udgifter i Bolig"))).toEqual(["Husleje", "Indboforsikring"]);
  });

  it("the sort survives Søjler and back, and a trip to Alle posteringer", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    const views = getByRole(root, "group", { name: da.view });
    fireEvent.click(getByRole(views, "button", { name: da.bars }));
    await settle(app);
    expect(queryByRole(root, "table")).toBeNull();
    fireEvent.click(getByRole(views, "button", { name: "Faste udgifter" }));
    await settle(app);
    expect(header(card(root, "Faste udgifter"), c.perYear).getAttribute("aria-sort")).toBe("descending");

    fireEvent.click(getByRole(views, "button", { name: da.postings }));
    await settle(app);
    fireEvent.click(getByRole(root, "button", { name: da.showAll }));
    await settle(app);
    getByRole(root, "heading", { level: 1, name: da.allPostings });
    fireEvent.click(getByRole(getByRole(root, "navigation", { name: da.trail }), "link", { name: da.allSpending }));
    await settle(app);
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.view }), "button", { name: "Faste udgifter" }));
    await settle(app);
    expect(header(card(root, "Faste udgifter"), c.perYear).getAttribute("aria-sort")).toBe("descending");
  });

  it("the sort is not in the hash", async () => {
    const { app, root } = await mountWith(CARD);
    const push = vi.spyOn(history, "pushState");
    await sortBy(app, root, c.perYear);
    expect(location.hash).toBe("#card=subscriptions");
    expect(push).not.toHaveBeenCalled();
  });
});
