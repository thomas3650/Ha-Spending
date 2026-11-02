import type { ClassifiedPosting, Posting } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, getByText, queryByRole, queryByText, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../src/components/shops";
import type { Shops } from "../src/components/shops";
import { kr } from "../src/format";
import { da } from "../src/i18n/da";
import { type ShopList, shopList } from "../src/model/shops";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { KEEP_NBSP } from "./text";

let ids = 0;

function posting(shop: string | null, amount: number): ClassifiedPosting {
  ids += 1;
  return {
    id: `t${ids}`,
    groupId: `t${ids}`,
    date: "2026-05-01",
    text: shop ?? "Kontant",
    account: "1",
    category: "Café",
    shop,
    kind: amount < 0 ? "refund" : "spending",
    amount,
    subscription: null,
    mainGroup: "Mad",
  };
}

function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("the shop list", () => {
  it("rows are net, by sum then name, zero and below left out", () => {
    const list = shopList(
      [
        posting("Netto", 30000),
        posting("Netto", -5000),
        posting("Rema", 10000),
        posting("Føtex", 10000),
        posting("Aldi", 40000),
        posting("Aldi", -40000),
        posting("Lidl", 2000),
        posting("Lidl", -9000),
      ],
      new Set(),
    );
    expect(list.visible.map((r) => [r.name, r.sum])).toEqual([
      ["Netto", 25000],
      ["Føtex", 10000],
      ["Rema", 10000],
    ]);
  });

  it("shares are of the whole base", () => {
    const list = shopList(
      [posting("Netto", 30000), posting("Rema", 10000), posting(null, 60000), posting("Udlejer", 100)],
      new Set(["Udlejer"]),
    );
    expect(list.visible.map((r) => r.share)).toEqual([30, 10]);
    expect(list.hidden.map((r) => r.share)).toEqual([0]);
    expect(shopList([posting("Netto", 100), posting(null, -500)], new Set()).visible[0]?.share).toBe(0);
  });

  it("noShop sums postings with no shop", () => {
    expect(shopList([posting(null, 15000), posting(null, -5000), posting("Netto", 100)], new Set()).noShop).toBe(10000);
    expect(shopList([posting("Netto", 100)], new Set()).noShop).toBe(0);
  });

  it("hidden shops are split out with their sum", () => {
    const list = shopList(
      [posting("Udlejer", 800000), posting("Kommunen", 200000), posting("Netto", 30000), posting("Gone", -100)],
      new Set(["Kommunen", "Udlejer", "Gone", "Elsewhere"]),
    );
    expect(list.visible.map((r) => r.name)).toEqual(["Netto"]);
    expect(list.hidden.map((r) => r.name)).toEqual(["Udlejer", "Kommunen"]);
    expect(list.hiddenSum).toBe(1000000);
  });
});

interface Fired {
  name: string;
  detail: unknown;
}

const LIST: ShopList = {
  visible: [
    { name: "Netto", sum: 30000, share: 30 },
    { name: "Rema", sum: 10000, share: 10 },
  ],
  hidden: [
    { name: "Udlejer", sum: 50000, share: 50 },
    { name: "Kommunen", sum: 5000, share: 5 },
  ],
  hiddenSum: 55000,
  noShop: 0,
};

async function render(props: Partial<Pick<Shops, "list" | "chosen" | "all" | "showHidden" | "canHide" | "limit">> = {}) {
  const el = document.createElement("hs-shops");
  Object.assign(el, { list: LIST, chosen: null, all: false, showHidden: false, canHide: true, limit: 10, ...props });
  const fired: Fired[] = [];
  for (const name of ["shop-open", "shop-hide", "shops-all-toggle", "shops-hidden-toggle"]) {
    el.addEventListener(name, (e) => fired.push({ name, detail: (e as CustomEvent).detail }));
  }
  document.body.append(el);
  await el.updateComplete;
  return { el, fired };
}

describe("the Butikker list", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows a row per visible shop with its place, sum, share and Skjul", async () => {
    const { el } = await render();
    const rows = getAllByRole(getAllByRole(el, "list")[0] as HTMLElement, "listitem");
    expect(rows.map(text)).toEqual([
      `1 Netto ${kr(30000).replace(/\s/g, " ")} ${da.share(30)} ${da.hide}`,
      `2 Rema ${kr(10000).replace(/\s/g, " ")} ${da.share(10)} ${da.hide}`,
    ]);
    getByRole(el, "button", { name: da.hideShop("Netto") });
    expect(queryByRole(el, "button", { name: da.showShop("Udlejer") })).toBeNull();
  });

  it("fires the name, a hide and the toggles", async () => {
    const { el, fired } = await render();
    fireEvent.click(getByRole(el, "button", { name: da.shopOption("Netto", kr(30000)) }));
    fireEvent.click(getByRole(el, "button", { name: da.hideShop("Rema") }));
    fireEvent.click(getByRole(el, "button", { name: da.showHidden(2, kr(55000)) }));
    expect(fired).toEqual([
      { name: "shop-open", detail: "Netto" },
      { name: "shop-hide", detail: { shop: "Rema", hidden: true } },
      { name: "shops-hidden-toggle", detail: null },
    ]);
  });

  it("shows the hidden shops in their own list with Vis and no place", async () => {
    const { el, fired } = await render({ showHidden: true });
    const lists = getAllByRole(el, "list");
    expect(lists).toHaveLength(2);
    const hidden = getAllByRole(lists[1] as HTMLElement, "listitem");
    expect(hidden.map(text)).toEqual([
      `Udlejer ${kr(50000).replace(/\s/g, " ")} ${da.share(50)} ${da.show}`,
      `Kommunen ${kr(5000).replace(/\s/g, " ")} ${da.share(5)} ${da.show}`,
    ]);
    fireEvent.click(getByRole(el, "button", { name: da.showShop("Kommunen") }));
    fireEvent.click(getByRole(el, "button", { name: da.shopOption("Udlejer", kr(50000)) }));
    fireEvent.click(getByRole(el, "button", { name: da.hideHidden }));
    expect(fired).toEqual([
      { name: "shop-hide", detail: { shop: "Kommunen", hidden: false } },
      { name: "shop-open", detail: "Udlejer" },
      { name: "shops-hidden-toggle", detail: null },
    ]);
  });

  it("has no Skjul and no Vis skjulte when it cannot hide", async () => {
    const { el } = await render({ canHide: false });
    expect(queryByRole(el, "button", { name: da.hideShop("Netto") })).toBeNull();
    expect(queryByRole(el, "button", { name: da.showHidden(2, kr(55000)) })).toBeNull();
    expect(getAllByRole(el, "list")).toHaveLength(1);
  });

  it("marks the chosen shop", async () => {
    const { el } = await render({ chosen: "Rema" });
    expect(getByRole(el, "button", { name: da.shopOption("Rema", kr(10000)) }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(getByRole(el, "button", { name: da.shopOption("Netto", kr(30000)) }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("toggles Vis alle", async () => {
    const { el, fired } = await render({ limit: 1 });
    fireEvent.click(getByRole(el, "button", { name: da.showAllShops(2) }));
    expect(fired).toEqual([{ name: "shops-all-toggle", detail: null }]);
  });
});

afterEach(unmount);

const NETTO = da.shopOption("Netto", kr(3150000));

function viewSwitch(root: HTMLElement): HTMLElement {
  return getByRole(root, "group", { name: da.view });
}

function card(root: HTMLElement, title = da.shops): HTMLElement {
  return getByRole(root, "region", { name: title });
}

function nameButtons(region: HTMLElement): HTMLElement[] {
  return getAllByRole(getAllByRole(region, "list")[0] as HTMLElement, "button").filter((b) =>
    b.hasAttribute("aria-pressed"),
  );
}

function names(region: HTMLElement): string[] {
  return nameButtons(region).map(text);
}

function labels(region: HTMLElement): (string | null)[] {
  return nameButtons(region).map((b) => b.getAttribute("aria-label"));
}

function withoutShops(range: { start: string; end: string }) {
  const answer = answerFor(range);
  return { ...answer, postings: answer.postings.map((p) => ({ ...p, shop: null })) };
}

function twelveShops(range: { start: string; end: string }) {
  const postings: Posting[] = Array.from({ length: 12 }, (_, i) => ({
    id: `s${i}`,
    groupId: `s${i}`,
    date: "2026-05-01",
    text: `Butik ${String(i + 1).padStart(2, "0")}`,
    account: "1",
    category: "Café",
    shop: `Butik ${String(i + 1).padStart(2, "0")}`,
    kind: "spending",
    amount: (20 - i) * 1000,
    subscription: null,
  }));
  return { ...answerFor(range), postings };
}

describe("the Butikker card", () => {
  it("Butikker is offered when a posting has a shop", async () => {
    const { app, root } = await mount("");
    const buttons = getAllByRole(viewSwitch(root), "button").map(text);
    expect(buttons).toEqual([da.bars, da.postings, da.shops]);
    fireEvent.click(getByRole(viewSwitch(root), "button", { name: da.shops }));
    await settle(app);
    card(root);
    expect(location.hash).toBe("#card=shops");
  });

  it("not without one, and card=shops falls back to Søjler", async () => {
    const { root } = await mount("card=shops", { answer: (range) => json(withoutShops(range)) });
    expect(queryByRole(viewSwitch(root), "button", { name: da.shops })).toBeNull();
    card(root, da.per("month"));
    expect(location.hash).toBe("");
  });

  it("the title follows the level", async () => {
    let { root } = await mount("card=shops");
    card(root, "Butikker");
    unmount();
    ({ root } = await mount("group=Mad&card=shops"));
    card(root, "Butikker i Mad");
    unmount();
    ({ root } = await mount("group=Mad&category=Caf%C3%A9&card=shops"));
    card(root, "Butikker i Café");
  });

  it("lists this year's shops by sum", async () => {
    const { root } = await mount("card=shops");
    expect(names(card(root))).toEqual(["Netto", "Boghandlen", "Q8", "Café Søde", "Shell", "Pizzeria Roma"]);
    expect(labels(card(root))).toEqual([
      NETTO,
      da.shopOption("Boghandlen", kr(120000)),
      da.shopOption("Q8", kr(90000)),
      da.shopOption("Café Søde", kr(81012)),
      da.shopOption("Shell", kr(60000)),
      da.shopOption("Pizzeria Roma", kr(50000)),
    ]);
  });

  it("the rows follow the level, the accounts and a chosen unit, with its chip", async () => {
    let { root } = await mount("group=Mad&card=shops");
    expect(names(card(root, "Butikker i Mad"))).toEqual(["Netto", "Café Søde", "Pizzeria Roma"]);
    unmount();
    ({ root } = await mount("accounts=2&card=shops"));
    expect(names(card(root))).toEqual(["Q8", "Café Søde", "Shell", "Pizzeria Roma"]);
    unmount();
    ({ root } = await mount("unit=2026-07-01&card=shops"));
    expect(labels(card(root))).toEqual([
      da.shopOption("Netto", kr(450000)),
      da.shopOption("Boghandlen", kr(120000)),
      da.shopOption("Q8", kr(90000)),
      da.shopOption("Café Søde", kr(50000)),
    ]);
    getByRole(card(root), "button", { name: da.remove("Juli 2026") });
  });

  it("the search and the chosen shop do not narrow the list, and the chosen shop is pressed", async () => {
    const { root } = await mount("card=shops&q=Shell&shop=Q8");
    expect(names(card(root))).toEqual(["Netto", "Boghandlen", "Q8", "Café Søde", "Shell", "Pizzeria Roma"]);
    const pressed = nameButtons(card(root)).filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map(text)).toEqual(["Q8"]);
  });

  it("a share reads 27 %", async () => {
    const { root } = await mount("card=shops");
    const rows = getAllByRole(getAllByRole(card(root), "list")[0] as HTMLElement, "listitem");
    const row = rows.find((r) => within(r).queryByRole("button", { name: NETTO }) !== null) as HTMLElement;
    getByText(row, "27 %");
  });

  it("Uden butik reads its sum, and is absent at Mad", async () => {
    let { root } = await mount("card=shops");
    getByText(card(root), da.noShop(kr(8015000)), KEEP_NBSP);
    expect(da.noShop(kr(8015000)).replace(/\s/g, " ")).toBe("Uden butik: 80.150 kr.");
    unmount();
    ({ root } = await mount("group=Mad&card=shops"));
    expect(queryByText(card(root, "Butikker i Mad"), /Uden butik/)).toBeNull();
  });

  it("10 rows and Vis alle, then Vis færre", async () => {
    const { app, root } = await mount("card=shops", { answer: (range) => json(twelveShops(range)) });
    expect(names(card(root))).toHaveLength(10);
    fireEvent.click(getByRole(card(root), "button", { name: da.showAllShops(12) }));
    await settle(app);
    expect(names(card(root))).toHaveLength(12);
    expect(location.hash).toBe("#card=shops");
    fireEvent.click(getByRole(card(root), "button", { name: da.showFewer }));
    await settle(app);
    expect(names(card(root))).toHaveLength(10);
  });

  it("full screen shows all and no Vis alle", async () => {
    const { app, root } = await mount("card=shops", { answer: (range) => json(twelveShops(range)) });
    fireEvent.click(getByRole(root, "button", { name: da.fullScreen }));
    await settle(app);
    expect(names(card(root))).toHaveLength(12);
    expect(queryByRole(card(root), "button", { name: da.showAllShops(12) })).toBeNull();
  });

  it("a click on a name shows the shop's postings, and Back returns to Butikker", async () => {
    const { app, root } = await mount("card=shops&q=Shell");
    const length = history.length;
    fireEvent.click(getByRole(card(root), "button", { name: NETTO }));
    await settle(app);
    expect(history.length).toBe(length + 1);
    expect(location.hash).toBe("#card=postings&shop=Netto");
    const postings = card(root, da.postingsTitle);
    getByRole(postings, "button", { name: da.remove(da.shopChip("Netto")) });
    history.back();
    await vi.waitFor(() => expect(location.hash).toBe("#card=shops&q=Shell"));
    await settle(app);
    card(root);
  });

  it("no posting in the period gives da.noSpending; postings but no shop give Ingen butikker at vise", async () => {
    let { root } = await mount("period=custom&from=2026-10-27&to=2026-10-29&card=shops");
    getByText(card(root), da.noSpending);
    unmount();
    ({ root } = await mount("group=Bil&unit=2026-08-01&card=shops"));
    getByText(card(root, "Butikker i Bil"), da.noSpending);
    unmount();
    ({ root } = await mount("group=Bolig&card=shops"));
    getByText(card(root, "Butikker i Bolig"), da.noShops);
  });
});
