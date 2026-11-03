import type { Level, SpendingData, Subscription } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import {
  backToOverview,
  chooseShop,
  chooseUnit,
  clearChoices,
  closeDetail,
  detailResolves,
  keepDetail,
  normalise,
  openDetail,
  openAllPostings,
  openAllPostingsFresh,
  openObjectGroupPostings,
  openPart,
  openShop,
  removeCategory,
  removeMainGroup,
  removeShop,
  removeUnit,
  setAccounts,
  setAmount,
  setCard,
  setCategory,
  setGrouping,
  setMainGroup,
  setObjectGroup,
  setPeriod,
  setSearch,
  setSort,
} from "../src/state/actions";
import { DEFAULT_STATE, type DetailKey, type ViewState } from "../src/state/view";
import { answerFor, SUBSCRIPTIONS } from "./fixture";

const mad: Level = { kind: "mainGroup", mainGroup: "Mad" };
const cafe: Level = { kind: "category", mainGroup: "Mad", category: "Café" };
const at = (level: Level): ViewState => ({ ...DEFAULT_STATE, level });
const chosen: ViewState = { ...DEFAULT_STATE, unit: "2026-07-01", card: "bars" };

describe("the actions", () => {
  it("drills down keeping the period and the chosen unit", () => {
    const s = openPart({ ...chosen, period: { preset: "lastYear" } }, "Mad");
    expect(s.level).toEqual(mad);
    expect(s.unit).toBe("2026-07-01");
    expect(s.card).toBe("bars");
    expect(s.period).toEqual({ preset: "lastYear" });
  });

  it("opens Uden hovedgruppe as a main group", () => {
    expect(openPart(DEFAULT_STATE, null).level).toEqual({ kind: "mainGroup", mainGroup: null });
  });

  it("toggles a category", () => {
    const inCafe = openPart(at(mad), "Café");
    expect(inCafe.level).toEqual(cafe);
    expect(openPart(inCafe, "Café").level).toEqual(mad);
    expect(openPart(inCafe, "Dagligvarer").level).toEqual({
      kind: "category",
      mainGroup: "Mad",
      category: "Dagligvarer",
    });
  });

  it("chooses a unit and toggles it off", () => {
    const s = chooseUnit(DEFAULT_STATE, "2026-07-01");
    expect(s.unit).toBe("2026-07-01");
    expect(s.card).toBe("postings");
    const off = chooseUnit({ ...s, card: "bars" }, "2026-07-01");
    expect(off.unit).toBeNull();
    expect(off.card).toBe("bars");
    expect(chooseUnit(s, "2026-08-01").unit).toBe("2026-08-01");
    expect(chooseUnit(s, "2026-08-01").card).toBe("postings");
  });

  it("keeps the postings card when a unit is toggled off", () => {
    const s = chooseUnit({ ...chosen, card: "postings" }, "2026-07-01");
    expect(s.unit).toBeNull();
    expect(s.card).toBe("postings");
  });

  it("drops the chosen unit with a new grouping or period", () => {
    const g = setGrouping(chosen, "week");
    expect(g.grouping).toBe("week");
    expect(g.unit).toBeNull();
    expect(g.card).toBe("bars");
    const p = setPeriod({ ...chosen, card: "postings" }, { preset: "lastMonth" });
    expect(p.period).toEqual({ preset: "lastMonth" });
    expect(p.unit).toBeNull();
    expect(p.card).toBe("postings");
  });

  it("removes the unit", () => {
    const s = removeUnit(chosen);
    expect(s.unit).toBeNull();
    expect(s.card).toBe("bars");
  });

  it("sets the card", () => {
    expect(setCard(DEFAULT_STATE, "postings").card).toBe("postings");
  });

  it("ticks all accounts as all", () => {
    expect(setAccounts(DEFAULT_STATE, ["2", "1"], ["1", "2"]).accounts).toBeNull();
    expect(setAccounts(DEFAULT_STATE, ["2"], ["1", "2"]).accounts).toEqual(["2"]);
    expect(setAccounts(DEFAULT_STATE, [], ["1", "2"]).accounts).toEqual([]);
  });

  it("opens Alle posteringer keeping the search", () => {
    const s = openAllPostings({ ...at(cafe), search: "rema", sort: { column: "amount", descending: true }, amount: { min: 1, max: null } });
    expect(s.screen).toBe("allPostings");
    expect(s.search).toBe("rema");
    expect(s.sort).toEqual(DEFAULT_STATE.sort);
    expect(s.amount).toBeNull();
    expect(s.level).toEqual(cafe);
  });

  it("opens Alle posteringer fresh: no search and no shop, the rest kept", () => {
    const from: ViewState = {
      ...at(cafe),
      accounts: ["2"],
      unit: "2026-07-01",
      card: "postings",
      search: "rema",
      shop: "Netto",
      sort: { column: "amount", descending: true },
      amount: { min: 1, max: null },
    };
    const s = openAllPostingsFresh(from);
    expect(s).toEqual({ ...openAllPostings(from), search: "", shop: null });
    expect(s.screen).toBe("allPostings");
    expect(s.level).toEqual(cafe);
    expect(s.accounts).toEqual(["2"]);
    expect(s.unit).toBe("2026-07-01");
    expect(s.period).toEqual(from.period);
    expect(s.sort).toEqual(DEFAULT_STATE.sort);
  });

  it("openObjectGroupPostings sets og and clears the search, the shop and the amount, keeps the unit, with the default sort", () => {
    const from: ViewState = {
      ...at(cafe),
      accounts: ["2"],
      period: { preset: "lastYear" },
      unit: "2026-07-01",
      search: "rema",
      shop: "Netto",
      sort: { column: "amount", descending: true },
      amount: { min: 1, max: null },
    };
    const s = openObjectGroupPostings(from, "Abonnementer");
    expect(s).toEqual({
      ...from,
      screen: "allPostings",
      objectGroup: "Abonnementer",
      search: "",
      shop: null,
      sort: DEFAULT_STATE.sort,
      amount: null,
    });
    expect(s.unit).toBe(from.unit);
    expect(openObjectGroupPostings({ ...from, card: "postings" }, "Abonnementer").card).toBe("postings");
  });

  it("leaves Alle posteringer through the trail with the shared choices kept", () => {
    const inAll = openAllPostings({ ...at(cafe), unit: "2026-07-01" });
    const s = backToOverview({
      ...inAll,
      search: "pizza",
      shop: "Netto",
      sort: { column: "date", descending: false },
      amount: { min: 1, max: null },
    });
    expect(s.screen).toBe("overview");
    expect(s.level).toEqual(cafe);
    expect(s.search).toBe("pizza");
    expect(s.shop).toBe("Netto");
    expect(s.sort).toEqual(DEFAULT_STATE.sort);
    expect(s.amount).toBeNull();
    expect(s.unit).toBe("2026-07-01");
  });

  it("clears the unit, the main group and the category from the overview's trail", () => {
    const s = clearChoices({ ...at(cafe), unit: "2026-07-01", search: "pizza", shop: "Netto", card: "postings" });
    expect(s.level).toEqual({ kind: "all" });
    expect(s.unit).toBeNull();
    expect(s.search).toBe("pizza");
    expect(s.shop).toBe("Netto");
    expect(s.card).toBe("postings");
  });

  it("opening Alle posteringer and the trail clear the object group", () => {
    const inAll = setObjectGroup(openAllPostings(at(cafe)), "Abonnementer");
    expect(inAll.objectGroup).toBe("Abonnementer");
    expect(setObjectGroup(inAll, null).objectGroup).toBeNull();
    expect(openAllPostings(inAll).objectGroup).toBeNull();
    expect(openAllPostingsFresh(inAll).objectGroup).toBeNull();
    expect(backToOverview(inAll).objectGroup).toBeNull();
    expect(setPeriod(inAll, { preset: "lastYear" }).objectGroup).toBe("Abonnementer");
    expect(setMainGroup(inAll, "Bil").objectGroup).toBe("Abonnementer");
    expect(removeMainGroup(inAll).objectGroup).toBe("Abonnementer");
  });

  it("normalise keeps an object group the answer does not carry", () => {
    const s = setObjectGroup(openAllPostings(DEFAULT_STATE), "Ukendt");
    expect(normalise(s, answerFor({ start: "2026-01-01", end: "2026-10-30" }), "2026-10-30").objectGroup).toBe("Ukendt");
  });

  it("keeps the search through the shared choices", () => {
    const s: ViewState = { ...DEFAULT_STATE, search: "rema", unit: "2026-07-01", card: "postings" };
    expect(openPart(s, "Mad").search).toBe("rema");
    expect(setCard(s, "bars").search).toBe("rema");
    expect(setPeriod(s, { preset: "lastMonth" }).search).toBe("rema");
    expect(setGrouping(s, "week").search).toBe("rema");
    expect(removeUnit(s).search).toBe("rema");
  });

  it("openShop chooses the shop, empties the search and shows Posteringer", () => {
    const s: ViewState = { ...DEFAULT_STATE, card: "shops", search: "rema", level: mad, unit: "2026-07-01" };
    expect(openShop(s, "Netto")).toEqual({ ...s, shop: "Netto", search: "", card: "postings" });
  });

  it("normalise keeps card=shops with a shop and drops it without", () => {
    const data = answerFor({ start: "2026-01-01", end: "2026-10-30" });
    const s: ViewState = { ...DEFAULT_STATE, card: "shops" };
    expect(normalise(s, data, "2026-10-30").card).toBe("shops");
    const without = { ...data, postings: data.postings.map((p) => ({ ...p, shop: null })) };
    expect(normalise(s, without, "2026-10-30").card).toBe("bars");
  });

  it("removes the category with its main group (D21)", () => {
    expect(removeMainGroup(at(cafe)).level).toEqual({ kind: "all" });
    expect(removeMainGroup(at(mad)).level).toEqual({ kind: "all" });
  });

  it("removes only the category", () => {
    expect(removeCategory(at(cafe)).level).toEqual(mad);
  });

  it("sets a main group or a category through the filter", () => {
    expect(setMainGroup(at(cafe), "Bil").level).toEqual({ kind: "mainGroup", mainGroup: "Bil" });
    expect(setMainGroup(at(cafe), null).level).toEqual({ kind: "mainGroup", mainGroup: null });
    expect(setCategory(DEFAULT_STATE, "Mad", "Café").level).toEqual(cafe);
    expect(setCategory(DEFAULT_STATE, null, null).level).toEqual({ kind: "category", mainGroup: null, category: null });
  });

  it("sets the search, the sort and the amount", () => {
    expect(setSearch(DEFAULT_STATE, "pizza").search).toBe("pizza");
    expect(setSort(DEFAULT_STATE, { column: "text", descending: false }).sort).toEqual({
      column: "text",
      descending: false,
    });
    expect(setAmount(DEFAULT_STATE, { min: null, max: 300 }).amount).toEqual({ min: null, max: 300 });
    expect(setAmount({ ...DEFAULT_STATE, amount: { min: 1, max: 2 } }, null).amount).toBeNull();
    expect(setAmount(DEFAULT_STATE, { min: null, max: null }).amount).toBeNull();
  });
});

describe("the subscriptions card", () => {
  const subs: ViewState = { ...DEFAULT_STATE, card: "subscriptions" };

  it("survives the period, the grouping, the accounts and the level", () => {
    expect(setPeriod(subs, { preset: "lastMonth" }).card).toBe("subscriptions");
    expect(setGrouping(subs, "week").card).toBe("subscriptions");
    expect(setAccounts(subs, ["1"], ["1", "2"]).card).toBe("subscriptions");
    expect(openPart(subs, "Mad").card).toBe("subscriptions");
    expect(clearChoices(at(cafe)).card).toBe("bars");
    expect(clearChoices({ ...subs, level: cafe }).card).toBe("subscriptions");
    expect(backToOverview(openAllPostings({ ...subs, level: cafe })).card).toBe("subscriptions");
    expect(removeMainGroup({ ...subs, level: cafe }).card).toBe("subscriptions");
    expect(removeCategory({ ...subs, level: cafe }).card).toBe("subscriptions");
  });

  it("survives a unit toggled off, and a chosen unit gives the postings", () => {
    const withUnit: ViewState = { ...subs, unit: "2026-07-01" };
    expect(removeUnit(withUnit).card).toBe("subscriptions");
    expect(chooseUnit(withUnit, "2026-07-01").card).toBe("subscriptions");
    expect(chooseUnit(subs, "2026-07-01").card).toBe("postings");
  });
});

describe("the chosen shop", () => {
  const netto: ViewState = { ...DEFAULT_STATE, search: "net", shop: "Netto" };

  it("is chosen with the search emptied, and removed", () => {
    const s = chooseShop({ ...DEFAULT_STATE, search: "net" }, "Netto");
    expect(s.shop).toBe("Netto");
    expect(s.search).toBe("");
    expect(removeShop(s).shop).toBeNull();
  });

  it("is kept by the actions that keep the search", () => {
    const kept = [
      openAllPostings(netto),
      clearChoices(netto),
      backToOverview(openAllPostings(netto)),
      openPart(netto, "Mad"),
      setCard(netto, "postings"),
      setPeriod(netto, { preset: "lastYear" }),
      setGrouping(netto, "week"),
      removeUnit({ ...netto, unit: "2026-07-01" }),
    ];
    for (const s of kept) expect(s.shop).toBe("Netto");
  });
});

describe("normalise", () => {
  const today = "2026-10-30";
  const data: SpendingData = {
    range: { start: "2026-01-01", end: today },
    today,
    earliestPostingDate: "2025-12-01",
    postings: [],
    accounts: [
      { id: "1", name: "Account one" },
      { id: "2", name: "Account two" },
    ],
    categories: [
      { name: "Brændstof", mainGroup: "Bil" },
      { name: "Café", mainGroup: "Mad" },
      { name: "Dagligvarer", mainGroup: "Mad" },
      { name: "Gaver", mainGroup: null },
      { name: "Husleje", mainGroup: "Bolig" },
    ],
    mainGroups: ["Bil", "Bolig", "Mad"],
    mainGroupsFound: true,
    fireflyLinkUrl: null,
    subscriptions: [],
  };
  const norm = (s: Partial<ViewState>) => normalise({ ...DEFAULT_STATE, ...s }, data, today);

  it("keeps a state the answer knows", () => {
    const s: ViewState = { ...DEFAULT_STATE, accounts: ["1"], level: cafe, unit: "2026-07-01", card: "postings" };
    expect(normalise(s, data, today)).toEqual(s);
  });

  it("keeps the chosen shop, also one with no posting", () => {
    expect(norm({ shop: "Ukendt", unit: "2020-01-01" }).shop).toBe("Ukendt");
  });

  it("keeps the search", () => {
    expect(norm({ search: "rema", unit: "2020-01-01" }).search).toBe("rema");
  });

  it("drops a main group the answer does not know", () => {
    expect(norm({ level: { kind: "mainGroup", mainGroup: "Ukendt" } }).level).toEqual({ kind: "all" });
    const unknown: Level = { kind: "category", mainGroup: "Ukendt", category: "Café" };
    expect(norm({ level: unknown }).level).toEqual({ kind: "all" });
    const without: Level = { kind: "mainGroup", mainGroup: null };
    expect(norm({ level: without }).level).toEqual(without);
  });

  it("drops a category that is not in its main group", () => {
    expect(norm({ level: { kind: "category", mainGroup: "Mad", category: "Husleje" } }).level).toEqual(mad);
    expect(norm({ level: { kind: "category", mainGroup: null, category: "Gaver" } }).level).toEqual({
      kind: "category",
      mainGroup: null,
      category: "Gaver",
    });
    expect(norm({ level: { kind: "category", mainGroup: "Mad", category: null } }).level).toEqual({
      kind: "category",
      mainGroup: "Mad",
      category: null,
    });
  });

  it("drops accounts the answer does not know, and keeps no accounts as none", () => {
    expect(norm({ accounts: ["9"] }).accounts).toEqual([]);
    expect(norm({ accounts: ["1", "9"] }).accounts).toEqual(["1"]);
    expect(norm({ accounts: [] }).accounts).toEqual([]);
    expect(norm({ accounts: null }).accounts).toBeNull();
  });

  it("drops a unit that is not in the period's timeline", () => {
    const s = norm({ unit: "2026-07-02", card: "postings" });
    expect(s.unit).toBeNull();
    expect(s.card).toBe("postings");
    expect(norm({ unit: "2025-07-01" }).unit).toBeNull();
    expect(norm({ unit: "2026-07-01", card: "postings" }).unit).toBe("2026-07-01");
  });

  describe("the subscriptions card", () => {
    const one: Subscription = {
      id: "1",
      name: "Streaming",
      objectGroup: "Abonnementer",
      repeat: "monthly",
      skip: 0,
      start: "2026-01-05",
      end: null,
      amountMin: 9900,
      amountMax: 9900,
      lastPayment: null,
    };
    const range = { start: "2026-01-01", end: today };
    const withOne = { ...answerFor(range), subscriptions: [one] };
    const state: ViewState = { ...DEFAULT_STATE, card: "subscriptions" };

    it("falls back to the bars without subscriptions", () => {
      expect(normalise(state, answerFor(range), today).card).toBe("bars");
    });

    it("keeps the card with a subscription", () => {
      expect(normalise(state, withOne, today).card).toBe("subscriptions");
    });
  });
});

describe("the detail", () => {
  const today = "2026-10-30";
  const base = answerFor({ start: "2025-12-01", end: today });
  const data: SpendingData = {
    ...base,
    subscriptions: SUBSCRIPTIONS,
    postings: base.postings.map((p) =>
      p.id === "p11" ? { ...p, subscription: { id: "b1", name: "Husleje", objectGroup: "Faste udgifter" } } : p,
    ),
  };
  const bill: DetailKey = { kind: "subscription", id: "b1" };
  const posting = (id: string): DetailKey => ({ kind: "posting", id });
  const state = (s: Partial<ViewState>): ViewState => ({ ...DEFAULT_STATE, ...s });
  const kept = (s: Partial<ViewState>) => normalise(state(s), data, today).detail;

  it("opens and closes", () => {
    const open = openDetail(DEFAULT_STATE, bill);
    expect(open).toEqual({ ...DEFAULT_STATE, detail: bill });
    expect(closeDetail(open)).toEqual(DEFAULT_STATE);
  });

  it.each<[string, Partial<ViewState>]>([
    ["a bill on Faste udgifter, whatever the accounts", { card: "subscriptions", accounts: ["2"], detail: bill }],
    ["a posting on Posteringer", { card: "postings", detail: posting("p23") }],
    ["a posting on Alle posteringer", { screen: "allPostings", detail: posting("p23") }],
    ["a posting of a listed bill on Faste udgifter", { card: "subscriptions", detail: posting("p11") }],
  ])("normalise keeps a detail that resolves: %s", (_, s) => {
    expect(kept(s)).toEqual(s.detail);
    expect(detailResolves(state(s), data, today)).toBe(true);
  });

  it.each<[string, Partial<ViewState>]>([
    ["an unknown bill", { card: "subscriptions", detail: { kind: "subscription", id: "b99" } }],
    ["an unknown posting", { card: "postings", detail: posting("p999") }],
    ["s: on Posteringer", { card: "postings", detail: bill }],
    ["s: on Alle posteringer", { card: "subscriptions", screen: "allPostings", detail: bill }],
    ["p: on Søjler", { card: "bars", detail: posting("p23") }],
    ["p: on Butikker", { card: "shops", detail: posting("p23") }],
    ["p: of an unlinked posting on Faste udgifter", { card: "subscriptions", detail: posting("p23") }],
    ["p: of a bill not listed on Faste udgifter", { card: "subscriptions", detail: posting("p24") }],
    ["a posting before the period", { card: "postings", detail: posting("p1") }],
    ["a posting on an unticked account", { card: "postings", accounts: ["1"], detail: posting("p23") }],
  ])("and drops it: %s", (_, s) => {
    expect(kept(s)).toBeNull();
    expect(detailResolves(state(s), data, today)).toBe(false);
  });

  it("normalise drops a bill's detail when Faste udgifter falls back to the bars", () => {
    const s = normalise(state({ card: "subscriptions", detail: bill }), { ...data, subscriptions: [] }, today);
    expect(s.card).toBe("bars");
    expect(s.detail).toBeNull();
  });

  it("keepDetail closes the detail when the card or the screen changes", () => {
    const onSubs = state({ card: "subscriptions", detail: bill });
    const onPostings = state({ card: "postings", detail: posting("p23") });
    const onBars = state({ card: "bars", detail: posting("p23") });
    const onShops = state({ card: "shops", detail: posting("p23") });
    expect(keepDetail(onSubs, setCard(onSubs, "bars")).detail).toBeNull();
    expect(keepDetail(onBars, chooseUnit(onBars, "2026-07-01")).detail).toBeNull();
    expect(keepDetail(onPostings, openAllPostings(onPostings)).detail).toBeNull();
    expect(keepDetail(onShops, openShop(onShops, "Netto")).detail).toBeNull();
    const all = openAllPostings(onPostings);
    expect(keepDetail(all, backToOverview(all)).detail).toBeNull();
  });

  it("the period, the accounts, the level, the unit, the search and the sort keep it", () => {
    const s = state({ card: "postings", detail: posting("p23") });
    const all = state({ screen: "allPostings", detail: posting("p23") });
    const nexts = [
      setPeriod(s, { preset: "lastYear" }),
      setGrouping(s, "week"),
      setAccounts(s, ["1"], ["1", "2"]),
      openPart(s, "Mad"),
      chooseUnit(s, "2026-07-01"),
      setSearch(s, "café"),
      chooseShop(s, "Café Søde"),
      setSort(all, { column: "amount", descending: true }),
      setAmount(all, { min: 1, max: null }),
      setObjectGroup(all, "Abonnementer"),
    ];
    for (const next of nexts) {
      expect(keepDetail(next.screen === "allPostings" ? all : s, next).detail).toEqual(s.detail);
    }
  });
});
