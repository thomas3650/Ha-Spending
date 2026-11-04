import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTING_SORT,
  DEFAULT_STATE,
  nextSort,
  parseHash,
  periodOf,
  postingFirstDescending,
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
      accounts: ["1"],
      level: { kind: "category", mainGroup: "Mad", category: "Café" },
      unit: "2026-02-02",
      card: "shops",
      fullScreen: true,
      search: "pizza",
      shop: "Netto",
      amount: { min: 100, max: null },
      detail: { kind: "posting", id: "p1" },
    };
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("ignores an old link's grouping and never writes one", () => {
    expect(parseHash("#by=week")).toEqual(DEFAULT_STATE);
    expect(parseHash("#by=year&period=lastYear")).toEqual({ ...DEFAULT_STATE, period: { preset: "lastYear" } });
    expect(toHash(parseHash("#by=quarter&period=all&unit=2026-04-01"))).toBe("period=all&unit=2026-04-01");
  });

  it("detail round-trips and is written last", () => {
    const s: ViewState = { ...DEFAULT_STATE, card: "subscriptions", detail: { kind: "subscription", id: "b1" } };
    expect(toHash(s)).toBe("card=subscriptions&detail=s%3Ab1");
    expect(parseHash("#card=subscriptions&detail=s%3Ab1")).toEqual(s);
    const all: ViewState = {
      ...DEFAULT_STATE,
      card: "postings",
      fullScreen: true,
      search: "rema",
      amount: { min: 500, max: null },
      detail: { kind: "posting", id: "p 7" },
    };
    expect(toHash(all)).toBe("card=postings&view=full&q=rema&min=5&detail=p%3Ap+7");
    expect(parseHash(toHash(all))).toEqual(all);
    expect(parseHash("detail=p:p1").detail).toEqual({ kind: "posting", id: "p1" });
    expect(DEFAULT_STATE.detail).toBeNull();
  });

  it("a bad detail is left out", () => {
    for (const hash of ["detail=x:1", "detail=s:", "detail=", "detail=s", "detail=p1"]) {
      expect(parseHash(hash).detail).toBeNull();
      expect(toHash(parseHash(hash))).toBe("");
    }
  });

  it("round-trips the subscriptions card", () => {
    expect(parseHash("card=subscriptions").card).toBe("subscriptions");
    const s: ViewState = { ...DEFAULT_STATE, card: "subscriptions" };
    expect(toHash(s)).toBe("card=subscriptions");
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("an old link to Forskel opens the bars", () => {
    expect(parseHash("card=difference").card).toBe("bars");
  });

  it("card=shops round-trips", () => {
    expect(parseHash("card=shops").card).toBe("shops");
    const s: ViewState = { ...DEFAULT_STATE, card: "shops" };
    expect(toHash(s)).toBe("card=shops");
    expect(parseHash("#" + toHash(s))).toEqual(s);
  });

  it("round-trips a preset, several accounts and both amount bounds", () => {
    const s: ViewState = {
      ...DEFAULT_STATE,
      period: { preset: "lastMonth" },
      accounts: ["1", "2"],
      amount: { min: 0, max: 500 },
    };
    expect(parseHash(toHash(s))).toEqual(s);
  });

  it("writes equal states as equal hashes", () => {
    const a: ViewState = { ...DEFAULT_STATE, accounts: ["1"], card: "postings", unit: "2026-07-01" };
    const b: ViewState = { ...DEFAULT_STATE, unit: "2026-07-01", card: "postings", accounts: ["1"] };
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
    expect(parseHash("period=custom&from=2026-03-01&to=2026-02-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("period=custom&from=2026-02-30&to=2026-03-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("period=custom&from=2026-02-01").period).toEqual(DEFAULT_STATE.period);
    expect(parseHash("category=Café").level).toEqual({ kind: "all" });
    expect(parseHash("unit=2026-13-01").unit).toBeNull();
    expect(parseHash("card=pie").card).toBe(DEFAULT_STATE.card);
    expect(parseHash("min=500&max=100").amount).toBeNull();
    expect(parseHash("min=-5").amount).toBeNull();
    expect(parseHash("min=1.5&max=10").amount).toEqual({ min: 150, max: 1000 });
    expect(parseHash("min=99999999999999999999").amount).toBeNull();
    expect(parseHash("view=elsewhere")).toEqual(DEFAULT_STATE);
  });

  it("reads the amount bounds in kroner with a dot for øre, and writes them back (D47)", () => {
    const amount = (hash: string) => parseHash(hash).amount;
    expect(amount("max=1000.50")).toEqual({ min: null, max: 100050 });
    expect(amount("max=1000.5")).toEqual({ min: null, max: 100050 });
    expect(amount("max=1000")).toEqual({ min: null, max: 100000 });
    expect(amount("min=0")).toEqual({ min: 0, max: null });
    expect(amount("max=1000.505")).toBeNull();
    expect(amount("max=1,50")).toBeNull();
    expect(amount("max=.50")).toBeNull();
    expect(amount("max=1000.")).toBeNull();
    expect(amount("min=10.50&max=10.25")).toBeNull();
    for (const range of [
      { min: null, max: 100050 },
      { min: 5, max: 100000 },
      { min: 0, max: 7 },
    ]) {
      const s: ViewState = { ...DEFAULT_STATE, amount: range };
      expect(parseHash(toHash(s))).toEqual(s);
    }
    const hash = (min: number | null, max: number | null) => toHash({ ...DEFAULT_STATE, amount: { min, max } });
    expect(hash(null, 100050)).toBe("max=1000.50");
    expect(hash(5, 100000)).toBe("min=0.05&max=1000");
    expect(hash(0, null)).toBe("min=0");
  });

  it("reads and writes the search in both widths", () => {
    const s = parseHash("q=rema");
    expect(s.search).toBe("rema");
    expect(parseHash("view=full&q=rema").search).toBe("rema");
    expect(toHash(s)).toBe("q=rema");
  });

  it("reads and writes the chosen shop", () => {
    const s = parseHash("shop=Netto");
    expect(s.shop).toBe("Netto");
    expect(toHash(s)).toBe("shop=Netto");
    expect(parseHash("shop=").shop).toBeNull();
    expect(parseHash("").shop).toBeNull();
  });

  it("writes the shop right after the search and before the amount", () => {
    const s: ViewState = { ...DEFAULT_STATE, search: "rema", shop: "Netto", amount: { min: 500, max: null } };
    expect(toHash(s)).toBe("q=rema&shop=Netto&min=5");
  });

  it("ignores an old link's sort and object group, and never writes them", () => {
    expect(parseHash("card=postings&sort=largest&og=Abonnementer")).toEqual({ ...DEFAULT_STATE, card: "postings" });
    expect(toHash(parseHash("q=rema&sort=oldest&og=Abonnementer"))).toBe("q=rema");
  });

  it("full screen is view=full, after the card and before the search", () => {
    const s: ViewState = { ...DEFAULT_STATE, card: "postings", fullScreen: true, search: "rema" };
    expect(toHash(s)).toBe("card=postings&view=full&q=rema");
    expect(parseHash("#" + toHash(s))).toEqual(s);
    expect(parseHash("view=full")).toEqual({ ...DEFAULT_STATE, fullScreen: true });
    expect(DEFAULT_STATE.fullScreen).toBe(false);
  });

  it("view=full holds for every tab and keeps the detail", () => {
    for (const card of ["bars", "postings", "subscriptions", "shops"] as const) {
      expect(parseHash(`card=${card}&view=full`)).toMatchObject({ card, fullScreen: true });
    }
    const s: ViewState = { ...DEFAULT_STATE, card: "postings", fullScreen: true, detail: { kind: "posting", id: "p1" } };
    expect(toHash(s)).toBe("card=postings&view=full&detail=p%3Ap1");
  });

  it("an old view=all-postings reads as Posteringer in full screen, without its sort and object group", () => {
    const old = parseHash("#view=all-postings&sort=oldest&og=X");
    expect(old).toEqual({ ...DEFAULT_STATE, card: "postings", fullScreen: true });
    expect(toHash(old)).toBe("card=postings&view=full");
    expect(parseHash("card=bars&view=all-postings&q=rema")).toEqual({
      ...DEFAULT_STATE,
      card: "postings",
      fullScreen: true,
      search: "rema",
    });
    expect(parseHash("view=wide")).toEqual(DEFAULT_STATE);
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

describe("the next sort", () => {
  it("turns the sorted column around and starts another in its first direction", () => {
    const byDate: Sort = { column: "date", descending: true };
    expect(nextSort(byDate, "date", postingFirstDescending)).toEqual({ column: "date", descending: false });
    expect(nextSort(byDate, "amount", postingFirstDescending)).toEqual({ column: "amount", descending: true });
    expect(nextSort(byDate, "text", postingFirstDescending)).toEqual({ column: "text", descending: false });
    expect(nextSort(LARGEST, "date", postingFirstDescending)).toEqual(byDate);
  });

  it("the postings start newest first", () => {
    expect(DEFAULT_POSTING_SORT).toEqual({ column: "date", descending: true });
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
