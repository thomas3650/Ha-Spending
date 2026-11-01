import type { Subscription } from "@ha-spending/shared";
import {
  fireEvent,
  getAllByRole,
  getByRole,
  getByText,
  queryByRole,
  within,
} from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { subscriptionRows } from "../src/model/subscriptions";
import { DEFAULT_STATE } from "../src/state/view";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const KEY_LABEL = "Faste udgifter om året";

function mountWith(
  hash: string,
  subscriptions: Subscription[] = SUBSCRIPTIONS,
  link: string | null = LINK,
) {
  return mount(hash, {
    answer: (range) =>
      json({
        ...withSubscriptions(answerFor(range), subscriptions),
        fireflyLinkUrl: link,
      }),
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
  return getAllByRole(region, "row")
    .slice(1)
    .filter((r) => within(r).queryByRole("rowheader") === null)
    .map((r) =>
      text(within(r).getAllByRole("cell")[0]).replace(/ næste .*$/, ""),
    );
}

function groupHeaders(region: HTMLElement): HTMLElement[] {
  return getAllByRole(region, "rowheader");
}

function groupRow(region: HTMLElement, name: string): HTMLElement {
  const header = groupHeaders(region).find((h) => text(h).startsWith(name));
  if (!header) throw new Error(`no group ${name}`);
  return header.closest("tr") as HTMLElement;
}

function groupNames(region: HTMLElement): string[] {
  return groupHeaders(region).map((h) =>
    text(h).replace(/ \d+ faste? udgifte?r?$/, ""),
  );
}

function row(region: HTMLElement, name: string): HTMLElement {
  return getByRole(region, "row", { name: new RegExp(`^${name}`) });
}

function cells(
  region: HTMLElement,
  name: string,
  withCategory = false,
): string[] {
  const all = within(row(region, name)).getAllByRole("cell").map(text);
  return withCategory ? all : [all[0], ...all.slice(2)];
}

describe("the subscriptions key number", () => {
  it("reads the cost per year of every subscription and opens the card", async () => {
    const { app, root } = await mountWith("");
    const button = keyNumber(root);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    getByRole(root, "button", {
      name: `${KEY_LABEL} 106.968 kr. 5 faste udgifter`,
    });

    fireEvent.click(button);
    await settle(app);
    const region = card(root, "Faste udgifter");
    getByText(region, "106.968 kr. om året");
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("true");
    expect(
      getByRole(viewSwitch(root), "button", {
        name: "Faste udgifter",
      }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(location.hash).toBe("#card=subscriptions");

    fireEvent.click(keyNumber(root));
    await settle(app);
    card(root, da.per("month"));
    expect(keyNumber(root).getAttribute("aria-pressed")).toBe("false");
    expect(location.hash).toBe("");
  });

  it("adds Faste udgifter to the switch", async () => {
    const { app, root } = await mountWith("");
    const buttons = getAllByRole(viewSwitch(root), "button").map((b) =>
      b.textContent?.trim(),
    );
    expect(buttons).toEqual([da.bars, da.postings, "Faste udgifter"]);
    fireEvent.click(
      getByRole(viewSwitch(root), "button", { name: "Faste udgifter" }),
    );
    await settle(app);
    card(root, "Faste udgifter");
  });

  it("counts one subscription in the singular", async () => {
    const { root } = await mountWith("", [SUBSCRIPTIONS[0]]);
    getByRole(root, "button", {
      name: `${KEY_LABEL} 96.000 kr. 1 fast udgift`,
    });
  });
});

describe("the subscriptions card", () => {
  it("lists every subscription in the order of its status within its group", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(
      getAllByRole(region, "columnheader").map((h) => h.textContent?.trim()),
    ).toEqual(["Fast udgift", "Kategori", "Beløb", "Om året", "Status"]);
    expect(rowNames(region)).toEqual([
      "Indboforsikring",
      "Husleje",
      "Bilforsikring",
      "Streaming",
      "Avis",
    ]);
    expect(cells(region, "Husleje")).toEqual([
      "Husleje næste 1. nov",
      "8.000 kr. pr. måned",
      "96.000 kr.",
      "Forventes 1. nov",
    ]);
    expect(cells(region, "Streaming").slice(1)).toEqual([
      "114 kr. pr. måned",
      "1.368 kr.",
      "Steget · 129 → 149 kr.",
    ]);
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
    expect(cells(region, "Avis").slice(1)).toEqual([
      "200 kr. hver 2. måned",
      "1.200 kr.",
      "Forventes 20. nov",
    ]);
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
    getByRole(root, "button", {
      name: `${KEY_LABEL} 99.600 kr. 2 faste udgifter`,
    });
  });

  it("puts one with no payment, and one whose category is unknown, in Uden hovedgruppe", async () => {
    const unknown: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b9",
      name: "Fitness",
      amountMin: 30000,
      amountMax: 30000,
      lastPayment: {
        date: "2026-10-01",
        amount: 30000,
        category: "Ukendt",
        account: "1",
      },
    };
    const all = [...SUBSCRIPTIONS, unknown];
    const { root } = await mountWith(`group=&card=subscriptions`, all);
    const region = card(root, `Faste udgifter i ${da.noMainGroup}`);
    expect(rowNames(region)).toEqual(["Fitness", "Avis"]);
    expect(groupNames(region)).toEqual([da.noCategory]);
    unmount();

    const again = await mountWith("", all);
    getByRole(again.root, "button", {
      name: `${KEY_LABEL} 110.568 kr. 6 faste udgifter`,
    });
  });

  it("leaves out those paid from an account not chosen, never one with no payment", async () => {
    const { root } = await mountWith("accounts=1&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter"))).toEqual([
      "Indboforsikring",
      "Husleje",
      "Avis",
    ]);
    getByRole(root, "button", {
      name: `${KEY_LABEL} 100.800 kr. 3 faste udgifter`,
    });
  });

  it("shows a category's subscriptions and its chip", async () => {
    const { root } = await mountWith(
      "group=Mad&category=Café&card=subscriptions",
    );
    const region = card(root, "Faste udgifter i Café");
    expect(rowNames(region)).toEqual(["Streaming"]);
    getByRole(region, "button", { name: da.remove("Café") });
    getByRole(root, "button", { name: `${KEY_LABEL} 1.368 kr. 1 fast udgift` });
  });

  it("does not follow the search", async () => {
    const { root } = await mountWith("q=Netto&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter")).sort()).toEqual(
      [
        "Indboforsikring",
        "Streaming",
        "Husleje",
        "Avis",
        "Bilforsikring",
      ].sort(),
    );
    getByRole(root, "button", {
      name: `${KEY_LABEL} 106.968 kr. 5 faste udgifter`,
    });
    expect(location.hash).toBe("#q=Netto&card=subscriptions");
  });

  it("does not follow a chosen unit or the period", async () => {
    const { app, root } = await mountWith("unit=2026-07-01&card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(
      queryByRole(root, "button", { name: da.remove("Juli 2026") }),
    ).toBeNull();
    expect(rowNames(region)).toHaveLength(5);
    getByRole(root, "button", {
      name: `${KEY_LABEL} 106.968 kr. 5 faste udgifter`,
    });
    getByRole(viewSwitch(root), "button", { name: da.difference });

    fireEvent.click(
      getByRole(root, "button", { name: new RegExp(`^${da.period}`) }),
    );
    await app.updateComplete;
    fireEvent.click(
      getByRole(getByRole(root, "group", { name: da.period }), "button", {
        name: da.presets.lastMonth,
      }),
    );
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth&card=subscriptions");
    expect(rowNames(card(root, "Faste udgifter"))).toHaveLength(5);
    getByRole(root, "button", {
      name: `${KEY_LABEL} 106.968 kr. 5 faste udgifter`,
    });
  });

  it("shows its rows in a period with no postings", async () => {
    const { root } = await mountWith(
      "period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions",
    );
    const region = card(root, "Faste udgifter");
    expect(rowNames(region)).toHaveLength(5);
    expect(within(region).queryByText(da.noSpending)).toBeNull();
  });

  it("links a name to the subscription in Firefly III", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    const link = getByRole(region, "link", { name: "Husleje" });
    expect(link.getAttribute("href")).toBe(`${LINK}/bills/show/b1`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(getAllByRole(region, "link")).toHaveLength(5);
  });

  it("has no links without the Firefly III address", async () => {
    const { root } = await mountWith("card=subscriptions", SUBSCRIPTIONS, null);
    expect(queryByRole(card(root, "Faste udgifter"), "link")).toBeNull();
  });

  it("says when a level has none", async () => {
    const { root } = await mountWith("accounts=1&group=Bil&card=subscriptions");
    const region = card(root, "Faste udgifter i Bil");
    getByText(region, "Ingen faste udgifter i Bil");
    expect(queryByRole(region, "table")).toBeNull();
    getByRole(root, "button", { name: `${KEY_LABEL} 0 kr. 0 faste udgifter` });
  });
});

describe("the subscriptions card grouped", () => {
  it("groups by main group at Alt forbrug, the biggest sum per year first, Uden hovedgruppe last", async () => {
    const { root } = await mountWith("card=subscriptions");
    const region = card(root, "Faste udgifter");
    expect(groupHeaders(region).map(text)).toEqual([
      "Bolig 2 faste udgifter",
      "Bil 1 fast udgift",
      "Mad 1 fast udgift",
      `${da.noMainGroup} 1 fast udgift`,
    ]);
    expect(
      within(groupRow(region, "Bolig")).getAllByRole("cell").map(text),
    ).toEqual(["", "", "99.600 kr.", ""]);
    expect(
      within(groupRow(region, "Bil")).getAllByRole("cell").map(text),
    ).toEqual(["", "", "4.800 kr.", ""]);
    expect(getAllByRole(region, "columnheader").map(text)).toContain(
      "Kategori",
    );
    expect(
      groupRow(region, "Bolig")
        .closest("tbody")
        ?.contains(row(region, "Husleje")),
    ).toBe(true);
    expect(
      groupRow(region, "Bil")
        .closest("tbody")
        ?.contains(row(region, "Husleje")),
    ).toBe(false);
    expect(
      groupRow(region, "Bil")
        .closest("tbody")
        ?.contains(row(region, "Bilforsikring")),
    ).toBe(true);
    expect(cells(region, "Husleje", true)[1]).toBe("Husleje");
    expect(cells(region, "Streaming", true)[1]).toBe("Café");
  });

  it("puts one with no payment and one with an unknown category last, reading Uden kategori", async () => {
    const unknown: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b9",
      name: "Fitness",
      amountMin: 30000,
      amountMax: 30000,
      lastPayment: {
        date: "2026-10-01",
        amount: 30000,
        category: "Ukendt",
        account: "1",
      },
    };
    const { root } = await mountWith("card=subscriptions", [
      ...SUBSCRIPTIONS,
      unknown,
    ]);
    const region = card(root, "Faste udgifter");
    expect(groupNames(region).at(-1)).toBe(da.noMainGroup);
    const last = groupRow(region, da.noMainGroup).closest(
      "tbody",
    ) as HTMLElement;
    expect(
      within(last)
        .getAllByRole("row")
        .slice(1)
        .map((r) =>
          text(within(r).getAllByRole("cell")[0]).replace(/ næste .*$/, ""),
        ),
    ).toEqual(["Fitness", "Avis"]);
    expect(cells(region, "Avis", true)[1]).toBe(da.noCategory);
    expect(cells(region, "Fitness", true)[1]).toBe(da.noCategory);
  });

  it("orders groups with the same sum per year by name", async () => {
    const make = (
      id: string,
      name: string,
      category: string,
    ): Subscription => ({
      ...SUBSCRIPTIONS[0],
      id,
      name,
      amountMin: 10000,
      amountMax: 10000,
      lastPayment: {
        date: "2026-10-01",
        amount: 10000,
        category,
        account: "1",
      },
    });
    const { root } = await mountWith("card=subscriptions", [
      make("c1", "Ens", "Husleje"),
      make("c2", "To", "Brændstof"),
      make("c3", "Tre", "Café"),
    ]);
    expect(groupNames(card(root, "Faste udgifter"))).toEqual([
      "Bil",
      "Bolig",
      "Mad",
    ]);
  });

  it("shows the groups in a period with no postings", async () => {
    const { root } = await mountWith(
      "period=custom&from=2025-01-01&to=2025-01-31&card=subscriptions",
    );
    const region = card(root, "Faste udgifter");
    expect(groupNames(region)).toEqual(["Bolig", "Bil", "Mad", da.noMainGroup]);
    expect(rowNames(region)).toHaveLength(5);
  });

  it("groups by category at a main group, with no Kategori column", async () => {
    const { root } = await mountWith("group=Bolig&card=subscriptions");
    const region = card(root, "Faste udgifter i Bolig");
    expect(groupHeaders(region).map(text)).toEqual([
      "Husleje 2 faste udgifter",
    ]);
    expect(getAllByRole(region, "columnheader").map(text)).not.toContain(
      "Kategori",
    );
    expect(
      within(groupRow(region, "Husleje")).getAllByRole("cell").map(text),
    ).toEqual(["", "99.600 kr.", ""]);
  });

  it("puts the no-payment and unknown-category ones of Uden hovedgruppe under one Uden kategori, last", async () => {
    const unknown: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b9",
      name: "Fitness",
      lastPayment: {
        date: "2026-10-01",
        amount: 30000,
        category: "Ukendt",
        account: "1",
      },
    };
    const gift: Subscription = {
      ...SUBSCRIPTIONS[0],
      id: "b8",
      name: "Gavekort",
      lastPayment: {
        date: "2026-10-01",
        amount: 800000,
        category: "Gaver",
        account: "1",
      },
    };
    const { root } = await mountWith("group=&card=subscriptions", [
      ...SUBSCRIPTIONS,
      unknown,
      gift,
    ]);
    const region = card(root, `Faste udgifter i ${da.noMainGroup}`);
    expect(groupNames(region)).toEqual(["Gaver", da.noCategory]);
    const none = groupRow(region, da.noCategory).closest(
      "tbody",
    ) as HTMLElement;
    expect(within(none).getByText("Fitness")).toBeTruthy();
    expect(within(none).getByText("Avis")).toBeTruthy();
  });

  it("has no group rows at a category", async () => {
    const { root } = await mountWith(
      "group=Mad&category=Café&card=subscriptions",
    );
    const region = card(root, "Faste udgifter i Café");
    expect(queryByRole(region, "rowheader")).toBeNull();
    expect(getAllByRole(region, "columnheader").map(text)).not.toContain(
      "Kategori",
    );
    expect(rowNames(region)).toEqual(["Streaming"]);
  });
});

describe("the answer's today", () => {
  it("sets the statuses, not the app's today", () => {
    const data = withSubscriptions(
      answerFor({ start: "2025-12-01", end: "2026-10-30" }),
    );
    const rows = subscriptionRows(
      viewContext(data, DEFAULT_STATE, "2026-11-07"),
    );
    const husleje = rows.find((r) => r.name === "Husleje");
    expect(husleje?.status.text).toBe("Forventes 1. nov");
    expect(husleje?.next).toBe("1. nov");
  });
});

describe("with no subscriptions", () => {
  it("shows three key numbers and no Faste udgifter", async () => {
    const { root } = await mount("card=subscriptions");
    expect(
      queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) }),
    ).toBeNull();
    getByRole(root, "group", { name: da.spendingInPeriod });
    expect(
      queryByRole(viewSwitch(root), "button", { name: "Faste udgifter" }),
    ).toBeNull();
    card(root, da.per("month"));
    expect(location.hash).toBe("");
  });

  it("keeps three bones and no fourth number while loading", async () => {
    const { root } = await mount("", {
      answer: () => new Promise<Response>(() => {}),
    });
    const busy = getAllByRole(root, "group", { name: da.loading })[0];
    expect(busy.children).toHaveLength(3);
    expect(
      queryByRole(root, "button", { name: new RegExp(`^${KEY_LABEL}`) }),
    ).toBeNull();
  });
});
