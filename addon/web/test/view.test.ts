import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  nextSort,
  parseHash,
  periodOf,
  postingFirstDescending,
  sameSort,
  type Sort,
  toHash,
  type ViewState,
} from "../src/state/view";

const LARGEST: Sort = { column: "amount", descending: true };

describe("the view state's hash", () => {
  it("opens on I år by month with every account", () => {
    expect(parseHash("")).toEqual(DEFAULT_STATE);
    expect(parseHash("#")).toEqual(DEFAULT_STATE);
    expect(toHash(DEFAULT_STATE)).toBe("");
  });

  it("round-trips every field", () => {
    const s: ViewState = {
      period: { preset: "custom", start: "2026-02-01", end: "2026-03-31" },
      grouping: "week",
      accounts: ["1"],
      level: { kind: "category", mainGroup: "Mad", category: "Café" },
      unit: "2026-02-02",
      card: "difference",
      screen: "allPostings",
      search: "pizza",
      shop: "Netto",
      sort: { column: "amount", descending: true },
      amount: { min: 100, max: null },
    };
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("round-trips the subscriptions card", () => {
    expect(parseHash("card=subscriptions").card).toBe("subscriptions");
    const s: ViewState = { ...DEFAULT_STATE, card: "subscriptions" };
    expect(toHash(s)).toBe("card=subscriptions");
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("round-trips a preset, several accounts and both amount bounds", () => {
    const s: ViewState = {
      ...DEFAULT_STATE,
      period: { preset: "lastMonth" },
      accounts: ["1", "2"],
      screen: "allPostings",
      amount: { min: 0, max: 500 },
    };
    expect(parseHash(toHash(s))).toEqual(s);
  });

  it("writes equal states as equal hashes", () => {
    const a: ViewState = { ...DEFAULT_STATE, grouping: "day", card: "postings", unit: "2026-07-01" };
    const b: ViewState = { ...DEFAULT_STATE, unit: "2026-07-01", card: "postings", grouping: "day" };
    expect(toHash(a)).toBe(toHash(b));
  });

  it("keeps Uden hovedgruppe and Uden kategori apart from no filter", () => {
    const s = { ...DEFAULT_STATE, level: { kind: "category", mainGroup: null, category: null } } as ViewState;
    expect(toHash(s)).toBe("group=&category=");
    expect(parseHash("group=&category=").level).toEqual({ kind: "category", mainGroup: null, category: null });
    expect(parseHash("group=").level).toEqual({ kind: "mainGroup", mainGroup: null });
  });

  it("falls back on what does not parse", () => {
    const bad = parseHash("period=someday&by=hour&from=2026-02-30");
    expect(bad.period).toEqual(DEFAULT_STATE.period);
    expect(bad.grouping).toBe(DEFAULT_STATE.grouping);
    expect(parseHash("period=custom&from=2026-03-01&to=2026-02-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("period=custom&from=2026-02-30&to=2026-03-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("period=custom&from=2026-02-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("category=Café").level).toEqual({ kind: "all" });
    expect(parseHash("unit=2026-13-01").unit).toBeNull();
    expect(parseHash("card=pie").card).toBe(DEFAULT_STATE.card);
    expect(parseHash("view=all-postings&sort=random").sort).toEqual(DEFAULT_STATE.sort);
    expect(parseHash("view=all-postings&min=500&max=100").amount).toBeNull();
    expect(parseHash("view=all-postings&min=-5").amount).toBeNull();
    expect(parseHash("view=all-postings&min=1.5&max=10").amount).toEqual({ min: null, max: 10 });
    expect(parseHash("view=all-postings&min=99999999999999999999").amount).toBeNull();
    expect(parseHash("view=elsewhere").screen).toBe("overview");
  });

  it("reads and writes the search on every screen", () => {
    const s = parseHash("q=rema");
    expect(s.screen).toBe("overview");
    expect(s.search).toBe("rema");
    expect(toHash(s)).toBe("q=rema");
  });

  it("reads and writes the chosen shop on every screen", () => {
    const s = parseHash("shop=Netto");
    expect(s.shop).toBe("Netto");
    expect(toHash(s)).toBe("shop=Netto");
    expect(parseHash("shop=").shop).toBeNull();
    expect(parseHash("").shop).toBeNull();
  });

  it("writes the shop right after the search and before the sort", () => {
    const s: ViewState = { ...DEFAULT_STATE, screen: "allPostings", search: "rema", shop: "Netto", sort: LARGEST };
    expect(toHash(s)).toBe("view=all-postings&q=rema&shop=Netto&sort=largest");
  });

  it("writes the keys of Alle posteringer in a fixed order", () => {
    const s: ViewState = { ...DEFAULT_STATE, screen: "allPostings", search: "rema", sort: LARGEST, card: "postings" };
    expect(toHash(s)).toBe("card=postings&view=all-postings&q=rema&sort=largest");
  });

  it("reads the sort and amount only on Alle posteringer", () => {
    const s = parseHash("q=rema&sort=largest&min=5&card=postings");
    expect(s.sort).toEqual(DEFAULT_STATE.sort);
    expect(s.amount).toBeNull();
    expect(toHash({ ...DEFAULT_STATE, sort: LARGEST })).toBe("");
  });

  it("tells no accounts from all accounts", () => {
    expect(parseHash("accounts=").accounts).toEqual([]);
    expect(parseHash("").accounts).toBeNull();
    expect(toHash({ ...DEFAULT_STATE, accounts: [] })).toBe("accounts=");
  });

  it("round-trips Alt", () => {
    expect(parseHash("period=all").period).toEqual({ preset: "all" });
    const s: ViewState = { ...DEFAULT_STATE, period: { preset: "all" } };
    expect(toHash(s)).toBe("period=all");
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("encodes Danish names", () => {
    const s: ViewState = { ...DEFAULT_STATE, level: { kind: "mainGroup", mainGroup: "Børn & unge" } };
    expect(parseHash(toHash(s)).level).toEqual(s.level);
    expect(parseHash("#" + toHash(s)).level).toEqual(s.level);
  });
});

describe("the postings' sort in the hash", () => {
  const all = (sort: Sort): ViewState => ({ ...DEFAULT_STATE, screen: "allPostings", sort });
  const sortIn = (hash: string) => new URLSearchParams(hash).get("sort");

  it("reads the old sort names", () => {
    const named: [string, Sort][] = [
      ["newest", { column: "date", descending: true }],
      ["oldest", { column: "date", descending: false }],
      ["largest", { column: "amount", descending: true }],
      ["smallest", { column: "amount", descending: false }],
    ];
    for (const [name, sort] of named) {
      const s = parseHash(`view=all-postings&sort=${name}`);
      expect(s.sort).toEqual(sort);
      expect(sortIn(toHash(s))).toBe(name === "newest" ? null : name);
    }
  });

  it("round-trips a text column's sort", () => {
    const s = parseHash("view=all-postings&sort=account-desc");
    expect(s.sort).toEqual({ column: "account", descending: true });
    expect(toHash(s)).toBe("view=all-postings&sort=account-desc");
    for (const column of ["text", "category", "account"] as const) {
      for (const descending of [false, true]) {
        expect(parseHash(toHash(all({ column, descending }))).sort).toEqual({ column, descending });
      }
    }
  });

  it("falls back on an unknown sort", () => {
    expect(parseHash("view=all-postings&sort=price").sort).toEqual(DEFAULT_STATE.sort);
    expect(parseHash("view=all-postings&sort=date-asc").sort).toEqual(DEFAULT_STATE.sort);
  });

  it("a default sort made anew writes no sort", () => {
    expect(toHash(all({ column: "date", descending: true }))).toBe("view=all-postings");
  });
});

describe("the next sort", () => {
  it("turns the sorted column around and starts another in its first direction", () => {
    const byDate: Sort = { column: "date", descending: true };
    expect(nextSort(byDate, "date", postingFirstDescending)).toEqual({ column: "date", descending: false });
    expect(nextSort(byDate, "amount", postingFirstDescending)).toEqual({ column: "amount", descending: true });
    expect(nextSort(byDate, "text", postingFirstDescending)).toEqual({ column: "text", descending: false });
    expect(nextSort(LARGEST, "date", postingFirstDescending)).toEqual(byDate);
  });

  it("compares sorts by what they say", () => {
    expect(sameSort(LARGEST, { column: "amount", descending: true })).toBe(true);
    expect(sameSort(LARGEST, { column: "amount", descending: false })).toBe(false);
    expect(sameSort(LARGEST, { column: "date", descending: true })).toBe(false);
  });
});

describe("periodOf", () => {
  it("gives a preset's dates on today", () => {
    expect(periodOf({ preset: "thisYear" }, "2026-10-30", null)).toEqual({ start: "2026-01-01", end: "2026-10-30" });
  });

  it("gives the custom dates as they are", () => {
    expect(periodOf({ preset: "custom", start: "2026-02-01", end: "2026-03-31" }, "2026-10-30", null)).toEqual({
      start: "2026-02-01",
      end: "2026-03-31",
    });
  });
});
