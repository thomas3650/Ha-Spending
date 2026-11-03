import type { Posting, SpendingData, Subscription } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";

import { count, detailAmount, detailKr, tableDate } from "../src/format";
import { da } from "../src/i18n/da";
import { viewContext } from "../src/model/context";
import { detailView, type DetailView } from "../src/model/detail";
import { subscriptionRows } from "../src/model/subscriptions";
import { DEFAULT_STATE, type DetailKey, type ViewState } from "../src/state/view";
import { answerFor, LINK, SUBSCRIPTIONS, withSubscriptions } from "./fixture";

const FETCHED = { start: "2025-12-01", end: "2026-10-30" };
const TODAY = "2026-10-30";
const NBSP = "\u00a0";

const PIZZA: Subscription = {
  id: "b7",
  name: "Pizzaabonnement",
  objectGroup: "Abonnementer",
  repeat: "monthly",
  skip: 0,
  start: "2026-01-20",
  end: null,
  amountMin: 70000,
  amountMax: 70000,
  lastPayment: { date: "2026-09-20", amount: 70000, category: "Café", account: "2" },
};

/** The fixture's rent postings linked to the Husleje bill, b1. */
function linkedRent(answer: SpendingData = answerFor(FETCHED)): SpendingData {
  const postings = answer.postings.map(
    (p): Posting =>
      p.text === "Husleje" ? { ...p, subscription: { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" } } : p,
  );
  return withSubscriptions({ ...answer, postings });
}

function linkedPizza(answer: SpendingData = answerFor(FETCHED)): SpendingData {
  const postings = answer.postings.map(
    (p): Posting =>
      p.shop === "Pizzeria Roma" ? { ...p, subscription: { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" } } : p,
  );
  return withSubscriptions({ ...answer, postings }, [...SUBSCRIPTIONS, PIZZA]);
}

function view(key: DetailKey, data: SpendingData, state: Partial<ViewState> = {}): DetailView | null {
  return detailView(key, viewContext(data, { ...DEFAULT_STATE, ...state }, TODAY));
}

function shown(key: DetailKey, data: SpendingData, state: Partial<ViewState> = {}): DetailView {
  const v = view(key, data, state);
  if (v === null) throw new Error("no detail");
  return v;
}

const sub = (id: string): DetailKey => ({ kind: "subscription", id });
const posting = (id: string): DetailKey => ({ kind: "posting", id });

/** The fixture's ids: p24 is Pizzeria Roma's 700 kr. on 20 Sep, p25 its 200 kr. refund, p31 Kiosken. */
const PIZZA_PAID = "p24";
const PIZZA_REFUND = "p25";
const KIOSK = "p31";


describe("a detail's rows", () => {
  it("a subscription's rows are its postings in the period on the ticked accounts", () => {
    const v = shown(sub("b1"), linkedRent());
    expect(v.kind).toBe("subscription");
    expect(v.title).toBe("Husleje");
    expect(v.rows.map((r) => r.date)).toEqual(
      ["10", "09", "08", "07", "06", "05", "04", "03", "02", "01"].map((m) => tableDate(`2026-${m}-01`)),
    );
    expect(v.rows.every((r) => r.account === "Fælleskonto" && r.amount === "-8.000,00 kr." && !r.marked)).toBe(true);
    expect(v.boxes[0]).toEqual({ label: da.detailInPeriod, value: "80.000 kr.", count: count(10) });

    expect(shown(sub("b1"), linkedRent(), { accounts: ["2"] }).rows).toEqual([]);
    expect(shown(sub("b1"), linkedRent(), { accounts: ["2"] }).boxes[0].value).toBe("0 kr.");
    expect(shown(sub("b1"), linkedRent(), { period: { preset: "custom", start: "2026-03-01", end: "2026-04-30" } }).rows)
      .toHaveLength(2);
  });

  it("not narrowed by the level, a chosen unit, the search, the shop, the amount or the object group", () => {
    const data = linkedRent();
    const plain = shown(sub("b1"), data);
    const unit = "2026-03-01";
    expect(viewContext(data, { ...DEFAULT_STATE, unit }, TODAY).chosen).not.toBeNull();
    const narrowing: Partial<ViewState>[] = [
      { level: { kind: "mainGroup", mainGroup: "Bil" } },
      { level: { kind: "category", mainGroup: "Mad", category: "Café" } },
      { unit },
      { search: "Netto" },
      { shop: "Q8" },
      { screen: "allPostings", amount: { min: 1, max: 2 } },
      { screen: "allPostings", objectGroup: "Abonnementer" },
    ];
    for (const state of narrowing) {
      const v = shown(sub("b1"), data, state);
      expect(v.rows).toEqual(plain.rows);
      expect(v.boxes).toEqual(plain.boxes);
      expect(v.bars).toEqual(plain.bars);
    }
    const shop = shown(posting(PIZZA_PAID), answerFor(FETCHED));
    for (const state of narrowing) expect(shown(posting(PIZZA_PAID), answerFor(FETCHED), state).rows).toEqual(shop.rows);
  });

  it("the sum is net: a refund lowers it, counts as a row and reads with a plus", () => {
    const v = shown(sub("b7"), linkedPizza());
    expect(v.rows.map((r) => r.amount)).toEqual(["+200,00 kr.", "-700,00 kr."]);
    expect(v.boxes[0].value).toBe("500 kr.");
    expect(v.boxes[0].count).toBe(count(2));
  });

  it("a shop's rows are those with the same shop", () => {
    const v = shown(posting(PIZZA_PAID), answerFor(FETCHED));
    expect(v.kind).toBe("shop");
    expect(v.title).toBe("Pizzeria Roma");
    expect(v.rows.map((r) => [r.id, r.date, r.account, r.amount, r.marked])).toEqual([
      [PIZZA_REFUND, tableDate("2026-09-22"), "Kreditkort", "+200,00 kr.", false],
      [PIZZA_PAID, tableDate("2026-09-20"), "Kreditkort", "-700,00 kr.", true],
    ]);
    expect(v.boxes[0]).toEqual({ label: da.detailInPeriod, value: "500 kr.", count: count(2) });
    expect(shown(posting("p13"), answerFor(FETCHED)).rows).toHaveLength(10);
  });

  it("a posting with no shop gives the rows with no shop and the same text", () => {
    const v = shown(posting(KIOSK), answerFor(FETCHED));
    expect(v.title).toBe("Kiosken");
    expect(v.rows.map((r) => r.id)).toEqual([KIOSK]);
    expect(v.aside).toBe(tableDate("2026-02-14"));
  });
});

describe("what a key opens", () => {
  it("p: of a linked posting gives the subscription with that row marked", () => {
    const v = shown(posting(PIZZA_PAID), linkedPizza());
    expect(v.kind).toBe("subscription");
    expect(v.title).toBe("Pizzaabonnement");
    expect(v.key).toEqual(posting(PIZZA_PAID));
    expect(v.rows.filter((r) => r.marked).map((r) => r.id)).toEqual([PIZZA_PAID]);
  });

  it("p: whose bill is not in subscriptions gives the shop", () => {
    const v = shown(posting(PIZZA_PAID), withSubscriptions(answerFor(FETCHED)));
    expect(v.kind).toBe("shop");
    expect(v.title).toBe("Pizzeria Roma");
    expect(v.status).toBeNull();
  });

  it("s: marks no row", () => {
    const v = shown(sub("b7"), linkedPizza());
    expect(v.key).toEqual(sub("b7"));
    expect(v.rows.some((r) => r.marked)).toBe(false);
  });

  it("an unknown id gives null", () => {
    expect(view(sub("nope"), linkedRent())).toBeNull();
    expect(view(posting("nope"), linkedRent())).toBeNull();
    expect(view(posting("p1"), linkedRent())).toBeNull();
    expect(view(posting(PIZZA_PAID), linkedRent(), { accounts: ["1"] })).toBeNull();
  });
});

describe("a detail's bars", () => {
  it("one bar per unit of the period, none drawn at zero or below", () => {
    const months = shown(posting(PIZZA_PAID), answerFor(FETCHED));
    expect(months.per).toBe(da.detailPer("month"));
    expect(months.bars).toHaveLength(10);
    expect(months.bars.filter((b) => b.amount > 0).map((b) => b.label)).toEqual(["September 2026: 500 kr."]);
    expect(months.bars[0]).toMatchObject({ amount: 0, label: "Januar 2026: 0 kr." });

    const weeks = shown(posting(PIZZA_PAID), answerFor(FETCHED), { grouping: "week" });
    expect(weeks.per).toBe(da.detailPer("week"));
    expect(weeks.bars).toHaveLength(viewContext(answerFor(FETCHED), { ...DEFAULT_STATE, grouping: "week" }, TODAY).units.length);
    expect(weeks.bars.filter((b) => b.amount !== 0).map((b) => [b.amount, b.label])).toEqual([
      [70000, "Uge 38 2026: 700 kr."],
      [-20000, "Uge 39 2026: -200 kr."],
    ]);
  });
});

describe("a detail's head and boxes", () => {
  it("the context line: main group · object group, Uden hovedgruppe, and only the object group with no last payment", () => {
    const data = withSubscriptions(answerFor(FETCHED));
    expect(shown(sub("b1"), data).context).toBe("Bolig · Faste udgifter");
    expect(shown(sub("b6"), data).context).toBe(`${da.noMainGroup} · Abonnementer`);
    expect(shown(sub("b5"), data).context).toBe("Faste udgifter");
    expect(shown(posting(PIZZA_PAID), data).context).toBe(da.shopContext);
  });

  it("a subscription's head and boxes read as its Faste udgifter row", () => {
    const data = linkedRent();
    const v = shown(sub("b1"), data);
    const row = subscriptionRows(viewContext(data, DEFAULT_STATE, TODAY)).find((r) => r.id === "b1");
    expect(v.amount).toBe(`8.000${NBSP}kr. pr.${NBSP}måned`);
    expect(v.amount).toBe(row?.amount);
    expect(v.status).toEqual(row?.status);
    expect(v.status?.kind).toBe("expected");
    expect(v.href).toBe(`${LINK}/bills/show/b1`);
    expect(v.aside).toBeNull();
    expect(v.boxes[1]).toEqual({ label: da.subscriptionColumns.perYear, value: "96.000 kr." });
    expect(v.boxes[2]).toEqual({ label: da.columns.account, value: "Fælleskonto" });
  });

  it("a shop's head and boxes read as the clicked posting", () => {
    const v = shown(posting(PIZZA_PAID), answerFor(FETCHED));
    expect(v.amount).toBe("-700,00 kr.");
    expect(v.aside).toBe(`${tableDate("2026-09-20")} · MOBILEPAY 1234`);
    expect(v.boxes[1]).toEqual({ label: da.columns.account, value: "Kreditkort" });
    expect(v.boxes[2]).toEqual({ label: da.columns.category, value: "Café" });
  });

  it("Konto is – with no last payment, and Kategori is Uden kategori for a posting with none", () => {
    expect(shown(sub("b5"), withSubscriptions(answerFor(FETCHED))).boxes[2]).toEqual({
      label: da.columns.account,
      value: da.noAccount,
    });
    expect(shown(posting(KIOSK), answerFor(FETCHED)).boxes[2]).toEqual({
      label: da.columns.category,
      value: da.noCategory,
    });
  });

  it("the head's amount and the marked row read the same for one posting", () => {
    for (const id of [PIZZA_PAID, PIZZA_REFUND]) {
      const v = shown(posting(id), answerFor(FETCHED));
      const marked = v.rows.find((r) => r.marked);
      expect(marked?.amount).toBe(v.amount);
    }
    expect(shown(posting(PIZZA_REFUND), answerFor(FETCHED)).amount).toBe(detailAmount(-20000));
    expect(detailKr(-20000)).toBe("-200 kr.");
  });

  it("href is the bill for a subscription and the posting for a shop, and null without fireflyLinkUrl", () => {
    expect(shown(sub("b1"), linkedRent()).href).toBe(`${LINK}/bills/show/b1`);
    expect(shown(posting(PIZZA_PAID), answerFor(FETCHED)).href).toBe(`${LINK}/transactions/show/g24`);
    const unlinked = { ...linkedRent(), fireflyLinkUrl: null };
    expect(shown(sub("b1"), unlinked).href).toBeNull();
    expect(shown(posting(PIZZA_PAID), unlinked).href).toBeNull();
  });
});
