import type { Level, SpendingData } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import {
  chooseUnit,
  normalise,
  openAllPostings,
  openPart,
  removeCategory,
  removeMainGroup,
  removeUnit,
  setAccounts,
  setAmount,
  setCard,
  setCategory,
  setGrouping,
  setMainGroup,
  setPeriod,
  setSearch,
  setSort,
  trailLevel,
} from "../src/state/actions";
import { DEFAULT_STATE, type ViewState } from "../src/state/view";

const mad: Level = { kind: "mainGroup", mainGroup: "Mad" };
const cafe: Level = { kind: "category", mainGroup: "Mad", category: "Café" };
const at = (level: Level): ViewState => ({ ...DEFAULT_STATE, level });
const chosen: ViewState = { ...DEFAULT_STATE, unit: "2026-07-01", card: "difference" };

describe("the actions", () => {
  it("drills down keeping the period and the chosen unit", () => {
    const s = openPart({ ...chosen, period: { preset: "lastYear" } }, "Mad");
    expect(s.level).toEqual(mad);
    expect(s.unit).toBe("2026-07-01");
    expect(s.card).toBe("difference");
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
    expect(s.card).toBe("difference");
    const off = chooseUnit(s, "2026-07-01");
    expect(off.unit).toBeNull();
    expect(off.card).toBe("bars");
    expect(chooseUnit(s, "2026-08-01").unit).toBe("2026-08-01");
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

  it("opens Alle posteringer with no search, newest first and no amount", () => {
    const s = openAllPostings({ ...at(cafe), search: "pizza", sort: "largest", amount: { min: 1, max: null } });
    expect(s.screen).toBe("allPostings");
    expect(s.search).toBe("");
    expect(s.sort).toBe("newest");
    expect(s.amount).toBeNull();
    expect(s.level).toEqual(cafe);
  });

  it("leaves Alle posteringer through the trail", () => {
    const inAll = openAllPostings({ ...at(cafe), unit: "2026-07-01" });
    const s = trailLevel({ ...inAll, search: "pizza", sort: "oldest", amount: { min: 1, max: null } }, 1);
    expect(s.screen).toBe("overview");
    expect(s.level).toEqual(mad);
    expect(s.search).toBe("");
    expect(s.sort).toBe("newest");
    expect(s.amount).toBeNull();
    expect(s.unit).toBe("2026-07-01");
    expect(trailLevel(openAllPostings(at(cafe)), 0).level).toEqual({ kind: "all" });
    expect(trailLevel(openAllPostings(at(cafe)), 2).level).toEqual(cafe);
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
    expect(setSort(DEFAULT_STATE, "smallest").sort).toBe("smallest");
    expect(setAmount(DEFAULT_STATE, { min: null, max: 300 }).amount).toEqual({ min: null, max: 300 });
    expect(setAmount({ ...DEFAULT_STATE, amount: { min: 1, max: 2 } }, null).amount).toBeNull();
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
  };
  const norm = (s: Partial<ViewState>) => normalise({ ...DEFAULT_STATE, ...s }, data, today);

  it("keeps a state the answer knows", () => {
    const s: ViewState = { ...DEFAULT_STATE, accounts: ["1"], level: cafe, unit: "2026-07-01", card: "difference" };
    expect(normalise(s, data, today)).toEqual(s);
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
    const s = norm({ unit: "2026-07-02", card: "difference" });
    expect(s.unit).toBeNull();
    expect(s.card).toBe("bars");
    expect(norm({ unit: "2025-07-01" }).unit).toBeNull();
    expect(norm({ unit: "2026-07-01", card: "difference" }).unit).toBe("2026-07-01");
  });

  it("shows the bars instead of Forskel without a unit", () => {
    expect(norm({ card: "difference" }).card).toBe("bars");
    expect(norm({ card: "postings" }).card).toBe("postings");
  });
});
