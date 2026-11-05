import type { Subscription } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { da } from "../src/i18n/da";
import { kr, shortDate } from "../src/format";
import { viewContext } from "../src/model/context";
import { fixedView } from "../src/model/fixed";
import {
  DEFAULT_SUBSCRIPTION_SORT,
  subscriptionRows,
  subscriptionTable,
  type SubscriptionTable,
} from "../src/model/subscriptions";
import { DEFAULT_STATE, parseHash } from "../src/state/view";
import {
  answerFor,
  billPayment,
  LINK,
  SUBSCRIPTIONS,
  TAB_BILLS,
  TAB_HUSLEJE,
  TAB_POSTINGS,
  TAB_TODAY,
  tabBill,
  tabData,
  withSubscriptions,
} from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const KEY_LABEL = da.inPeriod("Faste udgifter");

function mountWith(hash: string, subscriptions: Subscription[] = SUBSCRIPTIONS, link: string | null = LINK) {
  return mount(hash, {
    answer: (range) => json({ ...withSubscriptions(answerFor(range), subscriptions), fireflyLinkUrl: link }),
  });
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

/** The name cell read without the object group's pill, which follows the fixed cost's name. */
function nameCell(r: HTMLElement): string {
  const cell = within(r).getAllByRole("cell")[0];
  const name = text(getByRole(cell, "button"));
  const rest = text(cell).slice(name.length).replace(/^ (Faste udgifter|Abonnementer)/, "");
  return name + rest;
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
  it("is a plain card; the view switch is the way to the card", async () => {
    const { root } = await mountWith("");
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
    getByRole(root, "group", { name: KEY_LABEL });
  });

  it("has no Faste udgifter tab on the overview", async () => {
    const { root } = await mountWith("");
    const buttons = getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim());
    expect(buttons).toEqual([da.bars, da.postings, da.shops]);
  });

  it("its link opens the view on Poster i perioden", async () => {
    const { app, root } = await mountWith("");
    fireEvent.click(getByRole(getByRole(root, "group", { name: KEY_LABEL }), "link", { name: da.showSubscriptions }));
    await settle(app);
    expect(location.hash).toBe("#view=fixed&og=Faste+udgifter");
    const tabs = getByRole(card(root, da.fixed.inPeriod), "group", { name: da.view });
    const pressed = getAllByRole(tabs, "button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => text(b))).toEqual([da.fixed.inPeriod]);
  });
});

describe("an old card=subscriptions link (spec §2.1)", () => {
  function pressedTab(root: HTMLElement): string[] {
    const tabs = getByRole(card(root, da.allFixed), "group", { name: da.view });
    return getAllByRole(tabs, "button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => text(b));
  }

  it("opens the view on Alle faste udgifter under Alle, and leaving it lands on Søjler", async () => {
    const { app, root } = await mountWith("card=subscriptions");
    expect(location.hash).toBe("#card=subscriptions");
    expect(pressedTab(root)).toEqual([da.allFixed]);
    getByRole(root, "button", { name: da.switchObjectGroup(da.allFixed) });
    getByRole(card(root, da.allFixed), "button", { name: "Husleje" });
    fireEvent.click(getByRole(root, "button", { name: da.backToOverview }));
    await settle(app);
    expect(location.hash).toBe("");
    const bars = getAllByRole(viewSwitch(root), "button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(bars.map((b) => text(b))).toEqual([da.bars]);
    card(root, da.per("month"));
  });

  it("lands on Søjler when the answer has no subscriptions", async () => {
    const { root } = await mountWith("card=subscriptions", []);
    expect(location.hash).toBe("");
    card(root, da.per("month"));
    expect(queryByRole(root, "button", { name: da.backToOverview })).toBeNull();
  });
});

describe("the Alle faste udgifter tab", () => {
  it("counts one subscription in the singular", async () => {
    const { root } = await mountWith("view=fixed&tab=all", [SUBSCRIPTIONS[0]]);
    expect(text(groupRow(card(root, da.allFixed), "Bolig"))).toContain(da.subscriptionCount(1));
  });

  it("shows a payment under 1 kr. above the max as no rise, and a larger one as what is paid now", async () => {
    const base = SUBSCRIPTIONS[1];
    const small = { ...base, amountMin: 9800, amountMax: 9900, lastPayment: { ...base.lastPayment!, amount: 9950 } };
    const large = { ...base, amountMin: 9940, amountMax: 9940, lastPayment: { ...base.lastPayment!, amount: 10060 } };
    const { root: smallRoot } = await mountWith("view=fixed&tab=all", [small]);
    expect(cells(card(smallRoot, da.allFixed), "Streaming").slice(1, 3)).toEqual(["99 kr. pr. måned", "1.182 kr."]);
    expect(text(card(smallRoot, da.allFixed))).not.toContain("Steget");
    unmount();
    const { root } = await mountWith("view=fixed&tab=all", [large]);
    expect(cells(card(root, da.allFixed), "Streaming").slice(1)).toEqual([
      "101 kr. pr. måned",
      "1.207 kr.",
      "Steget · 99 → 101 kr.",
    ]);
  });

  it("lists every subscription in the order of its status within its group", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(getAllByRole(region, "columnheader").map((h) => h.textContent?.replace(/[▲▼]/g, "").trim())).toEqual([
      "Fast udgift",
      "Kategori",
      "Beløb",
      "Om året",
      "Status",
    ]);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
    expect(cells(region, "Husleje")).toEqual(["Husleje næste 1. nov", "8.000 kr. pr. måned", "96.000 kr.", "Forventes 1. nov"]);
    expect(cells(region, "Streaming").slice(1)).toEqual(["149 kr. pr. måned", "1.788 kr.", "Steget · 129 → 149 kr."]);
    expect(cells(region, "Indboforsikring")[0]).toBe("Indboforsikring");
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
    getByText(
      region,
      "Fra Firefly III. Beløbet er midten af den faste udgifts beløbsinterval, eller den seneste betaling, når den er steget. Om året er det regnet om til et år.",
    );
    const box = getByRole(region, "group", { name: da.allFixed });
    expect(box.tabIndex).toBe(0);
    getByRole(box, "table");
  });

  it("shows a main group's subscriptions", async () => {
    const { root } = await mountWith("group=Bolig&view=fixed&tab=all");
    const region = card(root, da.allFixed);
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
    const { root } = await mountWith(`group=&view=fixed&tab=all`, all);
    const region = card(root, da.allFixed);
    expect(rowNames(region)).toEqual(["Tennisklub", "Fitness", "Avis"]);
    expect(groupNames(region)).toEqual(["Gaver", da.noCategory]);
  });

  it("leaves out those paid from an account not chosen, never one with no payment", async () => {
    const { root } = await mountWith("accounts=1&view=fixed&tab=all");
    expect(rowNames(card(root, da.allFixed))).toEqual(["Indboforsikring", "Husleje", "Avis", "Tennisklub"]);
  });

  it("shows a category's subscriptions, with no chip", async () => {
    const { root } = await mountWith("group=Mad&category=Café&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(rowNames(region)).toEqual(["Streaming"]);
    expect(queryByRole(region, "button", { name: da.remove("Café") })).toBeNull();
  });

  it("does not follow the search", async () => {
    const { root } = await mountWith("view=fixed&tab=all&q=Netto");
    expect(rowNames(card(root, da.allFixed))).toHaveLength(6);
    expect(location.hash).toBe("#view=fixed&tab=all&q=Netto");
  });

  it("follows the chosen unit and the period", async () => {
    const { app, root } = await mountWith("unit=2026-07-01&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(queryByRole(region, "button", { name: da.remove("Juli 2026") })).toBeNull();
    expect(rowNames(region)).not.toContain("Avis");
    expect(rowNames(region)).toHaveLength(5);

    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth&view=fixed&tab=all");
    expect(rowNames(card(root, da.allFixed))).toHaveLength(5);
  });

  it("shows its rows in a period with no postings", async () => {
    const { root } = await mountWith("period=custom&from=2025-01-01&to=2025-01-31&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(rowNames(region)).toEqual(["Husleje", "Indboforsikring", "Streaming"]);
    expect(within(region).queryByText(da.noSpending)).toBeNull();
  });

  it("shows each name as a button that opens its detail, with no link to Firefly III", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    const region = card(root, da.allFixed);
    const opened: unknown[] = [];
    region.addEventListener("detail-open", (e) => opened.push((e as CustomEvent).detail));
    fireEvent.click(getByRole(region, "button", { name: "Husleje" }));
    expect(opened).toEqual([{ kind: "subscription", id: "b1" }]);
    expect(queryByRole(region, "link")).toBeNull();
  });

  it("says when a level has none", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    getByText(region, "Ingen faste udgifter i Bil");
    expect(queryByRole(region, "table")).toBeNull();
  });
});

describe("the object groups in the Alle faste udgifter tab", () => {
  function sums(region: HTMLElement, title = da.allFixed): string[] {
    return getAllByRole(getByRole(region, "list", { name: da.objectGroupSums(title) }), "listitem").map(text);
  }

  it("marks each fixed cost with its object group", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(text(row(region, "Streaming"))).toContain("Abonnementer");
    expect(text(row(region, "Husleje"))).toContain("Faste udgifter");
  });

  it("keeps the fixed cost's name as its button's name", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    getByRole(card(root, da.allFixed), "button", { name: "Husleje" });
  });

  it("shows a yearly sum per object group, biggest first", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    expect(sums(card(root, da.allFixed))).toEqual([
      "Faste udgifter 105.600 kr. om året",
      "Abonnementer 3.588 kr. om året",
    ]);
  });

  it("has no single sum in the card's head", async () => {
    const { root } = await mountWith("view=fixed&tab=all");
    const region = card(root, da.allFixed);
    const kroner = (box: string) => Number(/([\d.]+) kr\./.exec(box)![1].replace(/\./g, ""));
    expect(sums(region).reduce((total, box) => total + kroner(box), 0)).toBe(109188);
    expect(text(region)).not.toContain("109.188");
  });

  it("orders boxes with equal sums by name", async () => {
    const equal = SUBSCRIPTIONS.slice(0, 2).map((s) => ({
      ...s,
      amountMin: 10000,
      amountMax: 10000,
      lastPayment: s.lastPayment && { ...s.lastPayment, amount: 10000, account: "1" },
    }));
    const { root } = await mountWith("view=fixed&tab=all", [
      { ...equal[0], objectGroup: "Faste udgifter" },
      { ...equal[1], objectGroup: "Abonnementer" },
    ]);
    expect(sums(card(root, da.allFixed))).toEqual([
      "Abonnementer 1.200 kr. om året",
      "Faste udgifter 1.200 kr. om året",
    ]);
  });

  it("shows one box at a main group with one object group", async () => {
    const { root } = await mountWith("group=Bolig&view=fixed&tab=all");
    expect(sums(card(root, da.allFixed))).toEqual(["Faste udgifter 99.600 kr. om året"]);
  });

  it("shows no box when no fixed cost is shown", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(text(region)).not.toContain("om året");
  });

  it("drops a box when its bills are on another account", async () => {
    const one = await mountWith("accounts=1&view=fixed&tab=all");
    expect(sums(card(one.root, da.allFixed))).toEqual([
      "Faste udgifter 100.800 kr. om året",
      "Abonnementer 1.800 kr. om året",
    ]);
    unmount();
    const two = await mountWith("accounts=2&view=fixed&tab=all");
    expect(sums(card(two.root, da.allFixed))).toHaveLength(2);
  });
});

describe("the Alle faste udgifter tab grouped", () => {
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
    const { root } = await mountWith("view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(groupHeaders(region).map(text)).toEqual([
      "Bolig 2 faste udgifter",
      "Bil 1 fast udgift",
      "Mad 1 fast udgift",
      `${da.noMainGroup} 2 faste udgifter`,
    ]);
    expect(within(groupRow(region, "Bolig")).getAllByRole("cell").map(text)).toEqual(["99.600 kr.", ""]);
    expect(within(groupRow(region, "Bil")).getAllByRole("cell").map(text)).toEqual(["4.800 kr.", ""]);
    expect(getAllByRole(region, "columnheader").map(text)).toContain("Kategori");
    expect(tbodyOf(region, "Bolig").contains(row(region, "Husleje"))).toBe(true);
    expect(tbodyOf(region, "Bil").contains(row(region, "Husleje"))).toBe(false);
    expect(tbodyOf(region, "Bil").contains(row(region, "Bilforsikring"))).toBe(true);
    expect(categoryOf(region, "Husleje")).toBe("Husleje");
    expect(categoryOf(region, "Streaming")).toBe("Café");
  });

  it("gives a group's row one row header over the empty columns, with and without Kategori", async () => {
    for (const [hash, group] of [
      ["view=fixed&tab=all", "Bolig"],
      ["group=Bolig&view=fixed&tab=all", "Husleje"],
    ]) {
      const { root } = await mountWith(hash);
      const row = groupRow(card(root, da.allFixed), group);
      const [header] = within(row).getAllByRole("rowheader") as HTMLTableCellElement[];
      expect(within(row).getAllByRole("rowheader")).toHaveLength(1);
      expect(within(row).getAllByRole("cell")).toHaveLength(2);
      const columns = within(card(root, da.allFixed)).getAllByRole("columnheader").length;
      expect(header.colSpan).toBe(columns - 2);
      unmount();
    }
  });

  it("puts one with no payment and one with an unknown category last, reading Uden kategori", async () => {
    const { root } = await mountWith("view=fixed&tab=all", [...SUBSCRIPTIONS, FITNESS]);
    const region = card(root, da.allFixed);
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
    const { root } = await mountWith("view=fixed&tab=all", all);
    expect(groupNames(card(root, da.allFixed))).toEqual(["Bil", "Bolig", "Mad"]);
  });

  it("shows the groups in a period with no postings", async () => {
    const { root } = await mountWith("period=custom&from=2025-01-01&to=2025-01-31&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(groupNames(region)).toEqual(["Bolig", "Mad"]);
    expect(rowNames(region)).toHaveLength(3);
  });

  it("groups by category at a main group, with no Kategori column", async () => {
    const { root } = await mountWith("group=Bolig&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(groupHeaders(region).map(text)).toEqual(["Husleje 2 faste udgifter"]);
    expect(getAllByRole(region, "columnheader").map(text)).not.toContain("Kategori");
    expect(within(groupRow(region, "Husleje")).getAllByRole("cell").map(text)).toEqual(["99.600 kr.", ""]);
  });

  it("puts the no-payment and unknown-category ones of Uden hovedgruppe under one Uden kategori, last", async () => {
    const gift: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b8",
      name: "Gavekort",
      lastPayment: { date: "2026-10-01", amount: 800000, category: "Gaver", account: "1" },
    };
    const { root } = await mountWith("group=&view=fixed&tab=all", [...SUBSCRIPTIONS, FITNESS, gift]);
    const region = card(root, da.allFixed);
    expect(groupNames(region)).toEqual(["Gaver", da.noCategory]);
    const none = tbodyOf(region, da.noCategory);
    within(none).getByText("Fitness");
    within(none).getByText("Avis");
  });

  it("has no group rows at a category", async () => {
    const { root } = await mountWith("group=Mad&category=Café&view=fixed&tab=all");
    const region = card(root, da.allFixed);
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

describe("a payment that is due", () => {
  const monthly = (id: string, name: string, lastDate: string): Subscription => ({
    id,
    name,
    objectGroup: "Faste udgifter",
    repeat: "monthly",
    skip: 0,
    start: lastDate,
    end: null,
    amountMin: 50000,
    amountMax: 50000,
    lastPayment: { date: lastDate, amount: 50000, category: "Husleje", account: "1" },
  });

  it("says Forfalden with its date and no next date, when the date is before today", async () => {
    const { root } = await mountWith("view=fixed&tab=all", [monthly("d1", "Fitness", "2026-09-28")]);
    expect(cells(card(root, da.allFixed), "Fitness")).toEqual([
      "Fitness",
      "500 kr. pr. måned",
      "6.000 kr.",
      "Forfalden 28. okt",
    ]);
  });

  it("flags the row as due, still expected, and keeps its place among the Forventes rows by date", () => {
    const weekly = (id: string, name: string, lastDate: string): Subscription => ({
      ...monthly(id, name, lastDate),
      repeat: "weekly",
    });
    // By date alone these would interleave: Fitness (26 Oct) before Tennis (27 Oct), Kaffe (4 Nov) before Bredbånd.
    const subscriptions = [
      monthly("d3", "Fitness", "2026-09-26"),
      weekly("d6", "Tennis", "2026-10-20"),
      monthly("d4", "Avis", "2026-09-30"),
      monthly("d5", "Bredbånd", "2026-10-05"),
      weekly("d7", "Kaffe", "2026-10-28"),
    ];
    const data = withSubscriptions(answerFor({ start: "2025-12-01", end: "2026-10-30" }), subscriptions);
    const rows = subscriptionRows(viewContext(data, DEFAULT_STATE, "2026-10-30"));
    const status = (name: string) => rows.find((r) => r.name.startsWith(name))?.status;
    expect(status("Fitness")).toEqual({ kind: "expected", due: true, text: da.status.due("26. okt") });
    expect(status("Tennis")).toMatchObject({ kind: "notSeen" });
    expect(status("Avis")).toMatchObject({ kind: "expected", due: false });
    expect(status("Bredbånd")).toMatchObject({ kind: "expected", due: false });
    expect(status("Kaffe")).toMatchObject({ kind: "paid" });
    const ours = new Set(subscriptions.map((s) => s.name));
    expect(rows.map((r) => r.name.split(" ")[0]).filter((n) => ours.has(n))).toEqual([
      "Tennis",
      "Fitness",
      "Avis",
      "Bredbånd",
      "Kaffe",
    ]);
  });

  it("says Forventes with its date and the next date, when the date is today", async () => {
    const { root } = await mountWith("view=fixed&tab=all", [monthly("d2", "Fitness", "2026-09-30")]);
    expect(cells(card(root, da.allFixed), "Fitness")).toEqual([
      "Fitness næste 30. okt",
      "500 kr. pr. måned",
      "6.000 kr.",
      "Forventes 30. okt",
    ]);
  });
});

describe("with no subscriptions", () => {
  it("shows plain key numbers and the overview's three tabs", async () => {
    const { root } = await mount("view=fixed&tab=all");
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
    expect(queryByRole(root, "button", { name: new RegExp(`^${da.inPeriod("Abonnementer")}`) })).toBeNull();
    getByRole(root, "group", { name: da.inPeriod("Abonnementer") });
    getByRole(root, "group", { name: da.spendingInPeriod });
    expect(getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim())).toEqual([
      da.bars,
      da.postings,
      da.shops,
    ]);
    card(root, da.per("month"));
    expect(location.hash).toBe("");
  });

  it("keeps two bones and no object group button while loading", async () => {
    const { root } = await mount("", { answer: () => new Promise<Response>(() => {}) });
    const busy = getAllByRole(root, "group", { name: da.loading })[0];
    expect(getAllByRole(busy, "listitem")).toHaveLength(2);
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
  });
});

describe("sorting the subscriptions by their headers", () => {
  const CARD = "view=fixed&tab=all";

  function header(region: HTMLElement, name: string): HTMLElement {
    return getByRole(region, "columnheader", { name });
  }

  async function sortBy(
    app: Parameters<typeof settle>[0],
    root: HTMLElement,
    name: string,
  ): Promise<void> {
    fireEvent.click(getByRole(header(card(root, da.allFixed), name), "button", { name }));
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
    const region = card(root, da.allFixed);
    expect(header(region, c.status).getAttribute("aria-sort")).toBe("ascending");
    expect(getAllByRole(region, "columnheader").filter((h) => h.hasAttribute("aria-sort"))).toHaveLength(1);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
  });

  it("Om året sorts inside each group, largest first", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    const region = card(root, da.allFixed);
    expect(header(region, c.perYear).getAttribute("aria-sort")).toBe("descending");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowsIn(region, "Bolig")).toEqual(["Husleje", "Indboforsikring"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
  });

  it("a second click flips it", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    await sortBy(app, root, c.perYear);
    const region = card(root, da.allFixed);
    expect(header(region, c.perYear).getAttribute("aria-sort")).toBe("ascending");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowsIn(region, "Bolig")).toEqual(["Indboforsikring", "Husleje"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Avis", "Tennisklub"]);
  });

  it("Beløb sorts by the amount per payment", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.amount);
    const region = card(root, da.allFixed);
    expect(header(region, c.amount).getAttribute("aria-sort")).toBe("descending");
    expect(rowsIn(region, "Bolig")).toEqual(["Husleje", "Indboforsikring"]);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Avis", "Tennisklub"]);
  });

  it("Fast udgift sorts A to Å", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.name);
    const region = card(root, da.allFixed);
    expect(header(region, c.name).getAttribute("aria-sort")).toBe("ascending");
    expect(rowNames(region)).toEqual(["Husleje", "Indboforsikring", "Bilforsikring", "Streaming", "Avis", "Tennisklub"]);
    await sortBy(app, root, c.name);
    expect(rowNames(card(root, da.allFixed))).toEqual([
      "Indboforsikring",
      "Husleje",
      "Bilforsikring",
      "Streaming",
      "Tennisklub",
      "Avis",
    ]);
  });

  it("sorts one list at a category", async () => {
    const { app, root } = await mountWith("group=Bolig&category=Husleje&view=fixed&tab=all");
    expect(rowNames(card(root, da.allFixed))).toEqual(["Indboforsikring", "Husleje"]);
    await sortBy(app, root, c.name);
    expect(rowNames(card(root, da.allFixed))).toEqual(["Husleje", "Indboforsikring"]);
  });

  it("Uden kategori sorts last both ways", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.category);
    const region = card(root, da.allFixed);
    expect(rowsIn(region, da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
    await sortBy(app, root, c.category);
    expect(header(card(root, da.allFixed), c.category).getAttribute("aria-sort")).toBe("descending");
    expect(rowsIn(card(root, da.allFixed), da.noMainGroup)).toEqual(["Tennisklub", "Avis"]);
  });

  it("a Kategori sort gives way to Status where Kategori is not shown, and comes back at Alt forbrug", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.category);
    await go(app, "group=Bolig&view=fixed&tab=all");
    const region = card(root, da.allFixed);
    expect(header(region, c.status).getAttribute("aria-sort")).toBe("ascending");
    expect(getAllByRole(region, "columnheader").filter((h) => h.hasAttribute("aria-sort"))).toHaveLength(1);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje"]);

    await go(app, CARD);
    expect(header(card(root, da.allFixed), c.category).getAttribute("aria-sort")).toBe("ascending");

    await go(app, "group=Bolig&view=fixed&tab=all");
    await sortBy(app, root, c.status);
    expect(header(card(root, da.allFixed), c.status).getAttribute("aria-sort")).toBe("descending");
    expect(rowNames(card(root, da.allFixed))).toEqual(["Husleje", "Indboforsikring"]);
  });

  it("the sort survives Poster i perioden and back, full screen, and a trip out of the view and in again", async () => {
    const { app, root } = await mountWith(CARD);
    await sortBy(app, root, c.perYear);
    const tab = (title: string, name: string) =>
      getByRole(getByRole(card(root, title), "group", { name: da.view }), "button", { name });
    fireEvent.click(tab(da.allFixed, da.fixed.inPeriod));
    await settle(app);
    expect(queryByRole(root, "columnheader", { name: c.perYear })).toBeNull();
    fireEvent.click(tab(da.fixed.inPeriod, da.allFixed));
    await settle(app);
    expect(header(card(root, da.allFixed), c.perYear).getAttribute("aria-sort")).toBe("descending");

    fireEvent.click(getByRole(root, "button", { name: da.fullScreenOf(da.allFixed) }));
    await settle(app);
    expect(header(card(root, da.allFixed), c.perYear).getAttribute("aria-sort")).toBe("descending");

    fireEvent.keyDown(window, { key: "Escape" });
    await settle(app);
    fireEvent.keyDown(window, { key: "Escape" });
    await vi.waitFor(() => expect(location.hash).toBe(""));
    await settle(app);
    fireEvent.click(getByRole(getByRole(root, "group", { name: KEY_LABEL }), "link", { name: da.showSubscriptions }));
    await settle(app);
    fireEvent.click(tab(da.fixed.inPeriod, da.allFixed));
    await settle(app);
    expect(header(card(root, da.allFixed), c.perYear).getAttribute("aria-sort")).toBe("descending");
  });

  it("the sort is not in the hash", async () => {
    const { app, root } = await mountWith(CARD);
    const push = vi.spyOn(history, "pushState");
    await sortBy(app, root, c.perYear);
    expect(location.hash).toBe("#view=fixed&tab=all");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("the Alle faste udgifter tab's rows", () => {
  function tab(hash: string, data = tabData()): SubscriptionTable {
    return subscriptionTable(viewContext(data, parseHash(hash), TAB_TODAY), DEFAULT_SUBSCRIPTION_SORT);
  }

  function names(t: SubscriptionTable): string[] {
    return t.rows.map((r) => r.name);
  }

  function rowOf(t: SubscriptionTable, name: string) {
    const found = t.rows.find((r) => r.name === name);
    if (found === undefined) throw new Error(`no row ${name}`);
    return found;
  }

  function groupOf(t: SubscriptionTable, name: string) {
    const found = t.groups?.find((g) => g.name === name);
    if (found === undefined) throw new Error(`no group ${name}`);
    return found;
  }

  const date = (d: string) => shortDate(d, TAB_TODAY);

  it("a bill that ended at a month's end is a row in that month and in I år, and not in the month after", () => {
    expect(names(tab("view=fixed&unit=2026-05-01"))).toContain("Avisabonnement");
    expect(names(tab("view=fixed"))).toContain("Avisabonnement");
    expect(names(tab("view=fixed&unit=2026-06-01"))).not.toContain("Avisabonnement");
  });

  it("a bill that starts after the time is no row, and one that starts later in I år is", () => {
    expect(names(tab("view=fixed&unit=2026-11-01"))).not.toContain("Vandabonnement");
    expect(names(tab("view=fixed&unit=2026-12-01"))).toContain("Vandabonnement");
    expect(names(tab("view=fixed"))).toContain("Vandabonnement");
  });

  it("a unit after today has its rows with today's statuses", () => {
    const december = tab("view=fixed&unit=2026-12-01");
    const year = tab("view=fixed");
    expect(names(december)).toEqual(["Vandabonnement", "Husleje", "Licens", "Vejhjælp"]);
    for (const row of december.rows) expect(row.status).toEqual(rowOf(year, row.name).status);
    expect(rowOf(december, "Vandabonnement").status.text).toBe(da.status.expected(date("2026-12-01")));
  });

  it("the object group, the level and Konti narrow the rows", () => {
    expect(names(tab("view=fixed&og=Abonnementer"))).toEqual(["Tidsskrift"]);
    expect(names(tab("view=fixed&og=Bil"))).toEqual(["Vejhjælp"]);
    expect(names(tab("view=fixed&group=Bolig"))).toEqual(["Husleje", "Licens", "Avisabonnement"]);
    expect(names(tab("view=fixed&accounts=2"))).toEqual(["Vandabonnement", "Vejhjælp", "Tidsskrift"]);
  });

  it("in I år an ended bill's Om året is left out of the sums, with its tooltip", () => {
    const year = tab("view=fixed");
    expect(rowOf(year, "Avisabonnement").notInSum).toBe(da.notInSum(date("2026-05-31")));
    expect(rowOf(year, "Avisabonnement").perYear).toBe(kr(180000));
    expect(rowOf(year, "Tidsskrift").notInSum).toBe(da.notInSum(date("2026-08-20")));
    expect(rowOf(year, "Husleje").notInSum).toBeNull();
    expect(rowOf(year, "Vandabonnement").notInSum).toBeNull();
    expect(year.objectGroups).toEqual([
      { name: "Faste udgifter", perYear: da.perYear(kr(9600000 + 120000 + 360000)) },
      { name: "Bil", perYear: da.perYear(kr(60000)) },
      { name: "Abonnementer", perYear: da.perYear(kr(0)) },
    ]);
    const bolig = groupOf(year, "Bolig");
    expect(bolig.perYear).toBe(kr(9600000 + 120000));
    expect(bolig.count).toBe(da.subscriptionCount(3));
    expect(groupOf(year, "Mad")).toMatchObject({ perYear: kr(0), count: da.subscriptionCount(1) });
  });

  it("in its last month, a bill that ends at the month's end counts in the sums, and one that ends mid-month does not", () => {
    const may = tab("view=fixed&unit=2026-05-01");
    expect(rowOf(may, "Avisabonnement").notInSum).toBeNull();
    expect(groupOf(may, "Bolig").perYear).toBe(kr(9600000 + 120000 + 180000));
    const august = tab("view=fixed&unit=2026-08-01");
    expect(rowOf(august, "Tidsskrift").notInSum).toBe(da.notInSum(date("2026-08-20")));
    expect(groupOf(august, "Mad").perYear).toBe(kr(0));
    expect(august.objectGroups).toContainEqual({ name: "Abonnementer", perYear: da.perYear(kr(0)) });
  });

  it("a past month's rows read their past statuses, with no næste under a name, and the Status sort puts Næste and then Sluttet last, by the status's date", () => {
    const fitness = tabBill("t7", "Fitness", {
      objectGroup: "Abonnementer",
      start: "2026-01-05",
      amountMin: 25000,
      amountMax: 25000,
      lastPayment: { date: "2026-10-05", amount: 25000, category: "Café", account: "2" },
    });
    const baadplads = tabBill("t8", "Bådplads", {
      repeat: "yearly",
      start: "2025-03-01",
      lastPayment: { date: "2026-03-01", amount: 10000, category: "Husleje", account: "1" },
    });
    const fitnessPaid = ["01", "02", "03", "04", "05", "06", "07", "09", "10"].map((m) =>
      billPayment(fitness, `2026-${m}-05`),
    );
    const data = tabData(
      [...TAB_BILLS, fitness, baadplads],
      [...TAB_POSTINGS, ...fitnessPaid, billPayment(baadplads, "2026-03-01")],
    );
    const august = tab("view=fixed&unit=2026-08-01", data);
    expect(august.rows.map((r) => [r.name, r.status.text, r.next])).toEqual([
      ["Fitness", da.status.notSeen(date("2026-08-05")), null],
      ["Husleje", da.status.paid(date("2026-08-01")), null],
      ["Licens", da.status.next(date("2026-12-15")), null],
      ["Vejhjælp", da.status.next(date("2027-02-10")), null],
      ["Bådplads", da.status.next(date("2027-03-01")), null],
      ["Tidsskrift", da.status.ended(date("2026-08-20")), null],
    ]);
    expect(rowOf(august, "Tidsskrift").status.kind).toBe("ended");
    expect(rowOf(august, "Licens").status.kind).toBe("next");
  });

  it("with its last due date missed, an ended bill reads Ikke set in the tab and in Poster i perioden", () => {
    const magasin = tabBill("t9", "Magasin", {
      start: "2025-01-20",
      end: "2026-10-25",
      lastPayment: { date: "2026-09-20", amount: 10000, category: "Husleje", account: "1" },
    });
    const data = tabData([...TAB_BILLS, magasin], [...TAB_POSTINGS, billPayment(magasin, "2026-09-20")]);
    expect(rowOf(tab("view=fixed", data), "Magasin").status.text).toBe(da.status.notSeen(date("2026-10-20")));
    const view = fixedView(viewContext(data, parseHash("view=fixed"), TAB_TODAY));
    expect(view.payments.filter((p) => p.name === "Magasin" && p.kind !== "paid")).toEqual([
      expect.objectContaining({ date: "2026-10-20", kind: "notSeen" }),
    ]);
  });

  it("a payment booked in another category, at a main-group level, still meets the bill's due date", () => {
    const postings = TAB_POSTINGS.map((p) =>
      p.subscription?.id === TAB_HUSLEJE.id && p.date === "2026-08-01" ? { ...p, category: "Café" } : p,
    );
    const august = tab("view=fixed&group=Bolig&unit=2026-08-01", tabData(TAB_BILLS, postings));
    expect(rowOf(august, "Husleje").status.text).toBe(da.status.paid(date("2026-08-01")));
  });
});
