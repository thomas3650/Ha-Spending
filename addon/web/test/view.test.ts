import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseHash, periodOf, toHash, type ViewState } from "../src/state/view";

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
      sort: "largest",
      amount: { min: 100, max: null },
    };
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
    expect(parseHash("view=all-postings&sort=random").sort).toBe(DEFAULT_STATE.sort);
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

  it("writes the keys of Alle posteringer in a fixed order", () => {
    const s: ViewState = { ...DEFAULT_STATE, screen: "allPostings", search: "rema", sort: "largest", card: "postings" };
    expect(toHash(s)).toBe("card=postings&view=all-postings&q=rema&sort=largest");
  });

  it("reads the sort and amount only on Alle posteringer", () => {
    const s = parseHash("q=rema&sort=largest&min=5&card=postings");
    expect(s.sort).toBe("newest");
    expect(s.amount).toBeNull();
    expect(toHash({ ...DEFAULT_STATE, sort: "largest" })).toBe("");
  });

  it("tells no accounts from all accounts", () => {
    expect(parseHash("accounts=").accounts).toEqual([]);
    expect(parseHash("").accounts).toBeNull();
    expect(toHash({ ...DEFAULT_STATE, accounts: [] })).toBe("accounts=");
  });

  it("encodes Danish names", () => {
    const s: ViewState = { ...DEFAULT_STATE, level: { kind: "mainGroup", mainGroup: "Børn & unge" } };
    expect(parseHash(toHash(s)).level).toEqual(s.level);
    expect(parseHash("#" + toHash(s)).level).toEqual(s.level);
  });
});

describe("periodOf", () => {
  it("gives a preset's dates on today", () => {
    expect(periodOf({ preset: "thisYear" }, "2026-10-30")).toEqual({ start: "2026-01-01", end: "2026-10-30" });
  });

  it("gives the custom dates as they are", () => {
    expect(periodOf({ preset: "custom", start: "2026-02-01", end: "2026-03-31" }, "2026-10-30")).toEqual({
      start: "2026-02-01",
      end: "2026-03-31",
    });
  });
});
