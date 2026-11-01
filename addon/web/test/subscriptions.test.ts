import type { Subscription } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole, within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { subscriptionRows } from "../src/model/subscriptions";
import { DEFAULT_STATE } from "../src/state/view";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const KEY_LABEL = "Abonnementer om året";

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

function rowNames(region: HTMLElement): string[] {
  const rows = getAllByRole(region, "row").slice(1);
  return rows.map((r) => text(within(r).getAllByRole("cell")[0]).replace(/ næste .*$/, ""));
}

function row(region: HTMLElement, name: string): HTMLElement {
  return getByRole(region, "row", { name: new RegExp(`^${name}`) });
}

function cells(region: HTMLElement, name: string): string[] {
  return within(row(region, name))
    .getAllByRole("cell")
    .map(text);
}

describe("the subscriptions key number", () => {
  it("reads the cost per year of every subscription and opens the card", async () => {
    const { app, root } = await mountWith("");
    const button = keyNumber(root);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    getByRole(root, "button", { name: `${KEY_LABEL} 106.968 kr. 5 abonnementer` });

    fireEvent.click(button);
    await settle(app);
    const region = card(root, "Abonnementer");
    getByText(region, "106.968 kr. om året");
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(viewSwitch(root), "button", { name: "Abonnementer" }).getAttribute("aria-pressed")).toBe("true");
    expect(location.hash).toBe("#card=subscriptions");

    fireEvent.click(keyNumber(root));
    await settle(app);
    card(root, da.per("month"));
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("false");
    expect(location.hash).toBe("");
  });

  it("adds Abonnementer to the switch", async () => {
    const { app, root } = await mountWith("");
    const buttons = getAllByRole(viewSwitch(root), "button").map((b) => b.textContent?.trim());
    expect(buttons).toEqual([da.bars, da.postings, "Abonnementer"]);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: "Abonnementer" }));
    await settle(app);
    card(root, "Abonnementer");
  });

  it("counts one subscription in the singular", async () => {
    const { root } = await mountWith("", [SUBSCRIPTIONS[0]]);
    getByRole(root, "button", { name: `${KEY_LABEL} 96.000 kr. 1 abonnement` });
  });
});

describe("the subscriptions card", () => {
  it("lists every subscription in the order of its status", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Abonnementer");
    expect(getAllByRole(region, "columnheader").map((h) => h.textContent?.trim())).toEqual([
      "Abonnement",
      "Beløb",
      "Om året",
      "Status",
    ]);
    expect(rowNames(region)).toEqual(["Indboforsikring", "Streaming", "Husleje", "Avis", "Bilforsikring"]);
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
    const box = getByRole(region, "group", { name: "Abonnementer" });
    expect(box.tabIndex).toBe(0);
    getByRole(box, "table");
  });

  it("shows a main group's subscriptions", async () => {
    const { root } = await mountWith("group=Bolig&card=subscriptions");
    const region = card(root, "Abonnementer i Bolig");
    expect(rowNames(region)).toEqual(["Indboforsikring", "Husleje"]);
    getByText(region, "99.600 kr. om året");
    getByRole(root, "button", { name: `${KEY_LABEL} 99.600 kr. 2 abonnementer` });
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
    expect(rowNames(card(root, `Abonnementer i ${da.noMainGroup}`))).toEqual(["Fitness", "Avis"]);
    unmount();

    const again = await mountWith("", all);
    getByRole(again.root, "button", { name: `${KEY_LABEL} 110.568 kr. 6 abonnementer` });
  });

  it("leaves out those paid from an account not chosen, never one with no payment", async () => {
    const { root } = await mountWith("accounts=1&card=subscriptions");
    expect(rowNames(card(root, "Abonnementer"))).toEqual(["Indboforsikring", "Husleje", "Avis"]);
    getByRole(root, "button", { name: `${KEY_LABEL} 100.800 kr. 3 abonnementer` });
  });

  it("shows a category's subscriptions and its chip", async () => {
    const { root } = await mountWith("group=Mad&category=Café&card=subscriptions");
    const region = card(root, "Abonnementer i Café");
    expect(rowNames(region)).toEqual(["Streaming"]);
    getByRole(region, "button", { name: da.remove("Café") });
    getByRole(root, "button", { name: `${KEY_LABEL} 1.368 kr. 1 abonnement` });
  });

  it("does not follow the search", async () => {
    const { root } = await mountWith("q=Netto&card=subscriptions");
    expect(rowNames(card(root, "Abonnementer"))).toEqual([
      "Indboforsikring",
      "Streaming",
      "Husleje",
      "Avis",
      "Bilforsikring",
    ]);
    getByRole(root, "button", { name: `${KEY_LABEL} 106.968 kr. 5 abonnementer` });
    expect(location.hash).toBe("#q=Netto&card=subscriptions");
  });

  it("does not follow a chosen unit or the period", async () => {
    const { app, root } = await mountWith("unit=2026-07-01&card=subscriptions");
    const region = card(root, "Abonnementer");
    expect(queryByRole(root, "button", { name: da.remove("Juli 2026") })).toBeNull();
    expect(rowNames(region)).toEqual(["Indboforsikring", "Streaming", "Husleje", "Avis", "Bilforsikring"]);
    getByRole(root, "button", { name: `${KEY_LABEL} 106.968 kr. 5 abonnementer` });
    getByRole(viewSwitch(root), "button", { name: da.difference });

    fireEvent.click(getByRole(root, "button", { name: new RegExp(`^${da.period}`) }));
    await app.updateComplete;
    fireEvent.click(getByRole(getByRole(root, "group", { name: da.period }), "button", { name: da.presets.lastMonth }));
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth&card=subscriptions");
    expect(rowNames(card(root, "Abonnementer"))).toHaveLength(5);
    getByRole(root, "button", { name: `${KEY_LABEL} 106.968 kr. 5 abonnementer` });
  });

  it("shows its rows in a period with no postings", async () => {
    const { root } = await mountWith("period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions");
    const region = card(root, "Abonnementer");
    expect(rowNames(region)).toHaveLength(5);
    expect(within(region).queryByText(da.noSpending)).toBeNull();
  });

  it("links a name to the subscription in Firefly III", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Abonnementer");
    const link = getByRole(region, "link", { name: "Husleje" });
    expect(link.getAttribute("href")).toBe(`${LINK}/bills/show/b1`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(getAllByRole(region, "link")).toHaveLength(5);
  });

  it("has no links without the Firefly III address", async () => {
    const { root } = await mountWith("card=subscriptions", SUBSCRIPTIONS, null);
    expect(queryByRole(card(root, "Abonnementer"), "link")).toBeNull();
  });

  it("says when a level has none", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&card=subscriptions");
    const region = card(root, "Abonnementer i Bil");
    getByText(region, "Ingen abonnementer i Bil");
    expect(queryByRole(region, "table")).toBeNull();
    getByRole(root, "button", { name: `${KEY_LABEL} 0 kr. 0 abonnementer` });
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
  it("shows three key numbers and no Abonnementer", async () => {
    const { root } = await mount("card=subscriptions");
    expect(queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) })).toBeNull();
    getByRole(root, "group", { name: da.spendingInPeriod });
    expect(queryByRole(viewSwitch(root), "button", { name: "Abonnementer" })).toBeNull();
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
