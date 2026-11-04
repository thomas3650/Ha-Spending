import type { Level, SpendingData, Subscription } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import {
  chooseShop,
  chooseFixedUnit,
  chooseUnit,
  clearChoices,
  closeDetail,
  detailResolves,
  keepDetail,
  leaveFixed,
  normalise,
  openDetail,
  openFixed,
  openPart,
  openPostingsFull,
  openShop,
  removeCategory,
  removeMainGroup,
  removeShop,
  removeUnit,
  setAccounts,
  setCard,
  setCategory,
  setMainGroup,
  setPeriod,
  setFullScreen,
  setSearch,
  setAmount,
  setObjectGroup,
} from "../src/state/actions";
import type { AmountFilter } from "../src/model/amount";
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

  it("drops the chosen unit with a new period", () => {
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

  it("opens Posteringer in full screen: no quick filter and no detail, the top filter kept", () => {
    const from: ViewState = {
      ...at(cafe),
      accounts: ["2"],
      period: { preset: "lastYear" },
      unit: "2026-07-01",
      card: "bars",
      search: "rema",
      shop: "Netto",
      amount: { kind: "under", value: 400_000 },
      detail: { kind: "posting", id: "p23" },
    };
    expect(openPostingsFull(from)).toEqual({
      ...from,
      card: "postings",
      fullScreen: true,
      search: "",
      shop: null,
      amount: null,
      detail: null,
    });
  });

  it("clears the unit, the main group and the category from the overview's trail", () => {
    const s = clearChoices({ ...at(cafe), unit: "2026-07-01", search: "pizza", shop: "Netto", card: "postings" });
    expect(s.level).toEqual({ kind: "all" });
    expect(s.unit).toBeNull();
    expect(s.search).toBe("pizza");
    expect(s.shop).toBe("Netto");
    expect(s.card).toBe("postings");
  });

  it("keeps the search through the shared choices", () => {
    const s: ViewState = { ...DEFAULT_STATE, search: "rema", unit: "2026-07-01", card: "postings" };
    expect(openPart(s, "Mad").search).toBe("rema");
    expect(setCard(s, "bars").search).toBe("rema");
    expect(setPeriod(s, { preset: "lastMonth" }).search).toBe("rema");
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

  it("sets the search", () => {
    expect(setSearch(DEFAULT_STATE, "pizza").search).toBe("pizza");
  });

  it("sets and clears the amount, the rest kept", () => {
    const s: ViewState = { ...DEFAULT_STATE, card: "postings", search: "rema", shop: "Netto", unit: "2026-07-01" };
    const under: AmountFilter = { kind: "under", value: 400_000 };
    expect(setAmount(s, under)).toEqual({ ...s, amount: under });
    expect(setAmount({ ...s, amount: under }, null)).toEqual(s);
  });

  it("keeps the amount through the tab, the period, the level, Alt forbrug and full screen", () => {
    const amount: AmountFilter = { kind: "between", min: 80_000, max: 120_000 };
    const s: ViewState = { ...DEFAULT_STATE, amount, unit: "2026-07-01", card: "postings" };
    expect(setCard(s, "bars").amount).toEqual(amount);
    expect(setPeriod(s, { preset: "lastMonth" }).amount).toEqual(amount);
    expect(openPart(s, "Mad").amount).toEqual(amount);
    expect(clearChoices({ ...s, level: cafe }).amount).toEqual(amount);
    expect(setFullScreen(s, true).amount).toEqual(amount);
  });
});

describe("the subscriptions card", () => {
  const subs: ViewState = { ...DEFAULT_STATE, card: "subscriptions" };

  it("survives the period, the accounts and the level", () => {
    expect(setPeriod(subs, { preset: "lastMonth" }).card).toBe("subscriptions");
    expect(setAccounts(subs, ["1"], ["1", "2"]).card).toBe("subscriptions");
    expect(openPart(subs, "Mad").card).toBe("subscriptions");
    expect(clearChoices(at(cafe)).card).toBe("bars");
    expect(clearChoices({ ...subs, level: cafe }).card).toBe("subscriptions");
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
      clearChoices(netto),
      openPart(netto, "Mad"),
      setCard(netto, "postings"),
      setPeriod(netto, { preset: "lastYear" }),
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

  it("keeps a unit the period's grouping starts on, and drops a week that starts mid-month", () => {
    expect(norm({ unit: "2026-04-01" }).unit).toBe("2026-04-01");
    expect(norm({ unit: "2026-03-09" }).unit).toBeNull();
    const all = { ...data, earliestPostingDate: "2024-03-01" };
    expect(normalise({ ...DEFAULT_STATE, period: { preset: "all" }, unit: "2025-01-01" }, all, today).unit).toBe(
      "2025-01-01",
    );
    expect(normalise({ ...DEFAULT_STATE, period: { preset: "all" }, unit: "2025-03-01" }, all, today).unit).toBeNull();
  });

  it("drops the unit in a one-unit period", () => {
    expect(norm({ period: { preset: "thisMonth" }, unit: "2026-10-01" }).unit).toBeNull();
    expect(norm({ period: { preset: "lastMonth" }, unit: "2026-09-01" }).unit).toBeNull();
    expect(normalise({ ...DEFAULT_STATE, unit: "2026-01-01" }, data, "2026-01-20").unit).toBeNull();
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
    ["a posting on Posteringer in full screen", { card: "postings", fullScreen: true, detail: posting("p23") }],
    ["a bill on Faste udgifter in full screen", { card: "subscriptions", fullScreen: true, detail: bill }],
    ["a posting of a listed bill on Faste udgifter", { card: "subscriptions", detail: posting("p11") }],
  ])("normalise keeps a detail that resolves: %s", (_, s) => {
    expect(kept(s)).toEqual(s.detail);
    expect(detailResolves(state(s), data, today)).toBe(true);
  });

  it.each<[string, Partial<ViewState>]>([
    ["an unknown bill", { card: "subscriptions", detail: { kind: "subscription", id: "b99" } }],
    ["an unknown posting", { card: "postings", detail: posting("p999") }],
    ["s: on Posteringer", { card: "postings", detail: bill }],
    ["s: on Posteringer in full screen", { card: "postings", fullScreen: true, detail: bill }],
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

  it("keepDetail closes the detail when the card changes", () => {
    const onSubs = state({ card: "subscriptions", detail: bill });
    const onBars = state({ card: "bars", detail: posting("p23") });
    const onShops = state({ card: "shops", detail: posting("p23") });
    expect(keepDetail(onSubs, setCard(onSubs, "bars")).detail).toBeNull();
    expect(keepDetail(onBars, chooseUnit(onBars, "2026-07-01")).detail).toBeNull();
    expect(keepDetail(onShops, openShop(onShops, "Netto")).detail).toBeNull();
  });

  it("turning full screen on keeps it, and turning it off closes it", () => {
    const s = state({ card: "postings", detail: posting("p23") });
    const on = setFullScreen(s, true);
    expect(on).toEqual({ ...s, fullScreen: true });
    expect(keepDetail(s, on).detail).toEqual(s.detail);
    const off = setFullScreen(on, false);
    expect(off).toEqual(s);
    expect(keepDetail(on, off).detail).toBeNull();
    expect(keepDetail(on, setCard(on, "subscriptions")).detail).toBeNull();
  });

  it("the period, the accounts, the level, the unit and the search keep it, in both widths", () => {
    for (const fullScreen of [false, true]) {
      const s = state({ card: "postings", fullScreen, detail: posting("p23") });
      const nexts = [
        setPeriod(s, { preset: "lastYear" }),
        setAccounts(s, ["1"], ["1", "2"]),
        openPart(s, "Mad"),
        chooseUnit(s, "2026-07-01"),
        setSearch(s, "café"),
        chooseShop(s, "Café Søde"),
      ];
      for (const next of nexts) expect(keepDetail(s, next).detail).toEqual(s.detail);
    }
  });
});

describe("the fixed-expenses view", () => {
  const today = "2026-10-30";
  const range = { start: "2025-12-01", end: today };
  const withBills = { ...answerFor(range), subscriptions: SUBSCRIPTIONS };
  const fixed: ViewState = { ...DEFAULT_STATE, fixed: true, objectGroup: "Faste udgifter" };

  it("opens with the group, leaving full screen and the detail and keeping the rest", () => {
    const from: ViewState = {
      ...DEFAULT_STATE,
      card: "shops",
      fullScreen: true,
      search: "rema",
      unit: "2026-07-01",
      detail: { kind: "posting", id: "p1" },
    };
    expect(openFixed(from, "Abonnementer")).toEqual({
      ...from,
      fixed: true,
      objectGroup: "Abonnementer",
      fullScreen: false,
      detail: null,
    });
  });

  it("openFixed and leaveFixed leave no full-screen card", () => {
    expect(openFixed({ ...DEFAULT_STATE, fixedFull: "list" }, "Abonnementer").fixedFull).toBeNull();
    expect(leaveFixed({ ...fixed, fixedFull: "bars" }).fixedFull).toBeNull();
  });

  it("setObjectGroup chooses the group and drops the unit", () => {
    expect(setObjectGroup({ ...fixed, unit: "2026-07-01" }, null)).toEqual({ ...fixed, objectGroup: null, unit: null });
    expect(setObjectGroup(fixed, "Abonnementer").objectGroup).toBe("Abonnementer");
  });

  it("chooseFixedUnit chooses and unchooses a unit and keeps the card", () => {
    const s: ViewState = { ...fixed, card: "bars" };
    expect(chooseFixedUnit(s, "2026-07-01")).toEqual({ ...s, unit: "2026-07-01" });
    expect(chooseFixedUnit({ ...s, unit: "2026-07-01" }, "2026-07-01")).toEqual(s);
  });

  it("leaveFixed turns fixed off and clears the group", () => {
    expect(leaveFixed({ ...fixed, search: "x" })).toEqual({ ...DEFAULT_STATE, search: "x" });
  });

  it("normalise keeps fixed with a known group", () => {
    expect(normalise(fixed, withBills, today)).toEqual(fixed);
  });

  it("normalise turns fixed off when the answer has no subscriptions", () => {
    const n = normalise({ ...fixed, fixedFull: "list" }, answerFor(range), today);
    expect(n.fixed).toBe(false);
    expect(n.fullScreen).toBe(false);
    expect(n.fixedFull).toBeNull();
    expect(n.objectGroup).toBeNull();
  });

  it("normalise drops a group the answer does not have", () => {
    expect(normalise({ ...fixed, objectGroup: "Ukendt" }, withBills, today).objectGroup).toBeNull();
  });

  it("normalise drops the group when there is only one", () => {
    const base = answerFor(range);
    const one = {
      ...base,
      postings: base.postings.map((p) => ({ ...p, subscription: null })),
      subscriptions: SUBSCRIPTIONS.filter((b) => b.objectGroup === "Faste udgifter"),
    };
    const n = normalise(fixed, one, today);
    expect(n.fixed).toBe(true);
    expect(n.objectGroup).toBeNull();
  });

  it("normalise drops the detail in the fixed view", () => {
    const withDetail: ViewState = { ...fixed, card: "subscriptions", detail: { kind: "subscription", id: "b1" } };
    expect(normalise({ ...withDetail, fixed: false, objectGroup: null }, withBills, today).detail).not.toBeNull();
    expect(normalise(withDetail, withBills, today).detail).toBeNull();
  });
});
