import { createFakeFirefly, exampleSeed, type SeedData } from "@ha-spending/dev";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient, type FetchLike, FireflyError } from "../src/firefly/client";
import type { ReadSettings } from "../src/firefly/read";
import { createDataLoader } from "../src/loader";

const settings: ReadSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 500,
  timeoutMs: 1000,
};
const JANUARY = { start: "2026-01-01", end: "2026-01-31" };
const FEBRUARY = { start: "2026-02-01", end: "2026-02-28" };
const MARCH = { start: "2026-03-01", end: "2026-03-31" };

const urlOf = (input: string | URL | Request) =>
  new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

function setUp(fail: (url: URL) => boolean = () => false, options: Partial<ReadSettings> = {}, seed = exampleSeed) {
  const fake = createFakeFirefly(seed);
  const paths: string[] = [];
  const urls: URL[] = [];
  const fetch: FetchLike = (input, init) => {
    const url = urlOf(input);
    paths.push(url.pathname);
    urls.push(url);
    return fail(url) ? Promise.resolve(new Response("{}", { status: 500 })) : fake.fetch(input, init);
  };
  const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
  const clock = { now: new Date(2026, 9, 30, 12) };
  const warn = vi.fn();
  const { loadData: load, loadLeftOver } = createDataLoader(
    client,
    { ...settings, ...options },
    () => clock.now,
    warn,
  );
  const asked = (pattern: RegExp) => paths.filter((path) => pattern.test(path)).length;
  const transactionReads = (range: { start: string; end: string }) =>
    urls.filter(
      (u) =>
        u.pathname === "/api/v1/transactions" &&
        u.searchParams.get("type") === "all" &&
        u.searchParams.get("start") === range.start &&
        u.searchParams.get("end") === range.end,
    ).length;
  return { load, loadLeftOver, clock, asked, warn, transactionReads };
}

const SPAN_FREE = {
  rules: /^\/api\/v1\/rule-groups\/[^/]+\/rules$/,
  categories: /^\/api\/v1\/categories$/,
  accounts: /^\/api\/v1\/accounts$/,
  bills: /^\/api\/v1\/bills$/,
};
/** The asset, revenue and liability accounts are three reads. */
const PER_SPAN_FREE: Record<keyof typeof SPAN_FREE, number> = { rules: 1, categories: 1, accounts: 3, bills: 1 };

const spanFreeReads = () => Object.entries(SPAN_FREE) as [keyof typeof SPAN_FREE, RegExp][];

describe("createDataLoader", () => {
  it("two spans read in a row share one span-free read of the rules, categories, accounts and bills", async () => {
    const { load, asked } = setUp();
    await load(JANUARY);
    const february = await load(FEBRUARY);
    for (const [name, pattern] of spanFreeReads()) expect(asked(pattern), name).toBe(PER_SPAN_FREE[name]);
    expect(february.postings.every((p) => p.date >= FEBRUARY.start && p.date <= FEBRUARY.end)).toBe(true);
    expect(february.categories.length).toBeGreaterThan(0);
  });

  it("a new day reads the span-free parts again", async () => {
    const { load, clock, asked } = setUp();
    clock.now = new Date(2026, 9, 30, 23, 58);
    await load(JANUARY);
    clock.now = new Date(2026, 9, 31, 0, 1);
    const march = await load(MARCH);
    for (const [name, pattern] of spanFreeReads()) expect(asked(pattern), name).toBe(2 * PER_SPAN_FREE[name]);
    expect(march.today).toBe("2026-10-31");
    const january = await load(JANUARY);
    expect(january.today).toBe("2026-10-31");
    for (const [name, pattern] of spanFreeReads()) expect(asked(pattern), name).toBe(2 * PER_SPAN_FREE[name]);
  });

  it("after a failed read of the rules the next call asks for them again", async () => {
    let failures = 1;
    const { load, asked } = setUp((url) => SPAN_FREE.rules.test(url.pathname) && failures-- > 0);
    await expect(load(JANUARY)).rejects.toBeInstanceOf(FireflyError);
    const january = await load(JANUARY);
    expect(asked(SPAN_FREE.rules)).toBe(2);
    expect(january.mainGroupsFound).toBe(true);
  });

  it("after a failed read of the bills the next call asks for them again", async () => {
    let failures = 1;
    const { load, asked } = setUp((url) => SPAN_FREE.bills.test(url.pathname) && failures-- > 0);
    await expect(load(JANUARY)).rejects.toBeInstanceOf(FireflyError);
    const january = await load(JANUARY);
    expect(asked(SPAN_FREE.bills)).toBe(2);
    expect(january.subscriptions.length).toBeGreaterThan(0);
  });

  it("warns of a main-group conflict on each answer that shares the kept parts", async () => {
    const { load, asked, warn } = setUp();
    await load(JANUARY);
    await load(FEBRUARY);
    expect(asked(SPAN_FREE.rules)).toBe(1);
    const conflicts = warn.mock.calls.filter(([message]) => String(message).includes("Streaming"));
    expect(conflicts).toHaveLength(2);
  });

  it("two spans at once, one whose transactions fail: the other answers with its data", async () => {
    const failsJanuary = (url: URL) =>
      url.pathname === "/api/v1/transactions" && url.searchParams.get("start") === JANUARY.start;
    const { load, asked } = setUp(failsJanuary);
    const [january, february] = await Promise.allSettled([load(JANUARY), load(FEBRUARY)]);
    expect(january.status).toBe("rejected");
    expect(february.status).toBe("fulfilled");
    const answer = (february as PromiseFulfilledResult<Awaited<ReturnType<typeof load>>>).value;
    expect(answer.postings.length).toBeGreaterThan(0);
    expect(answer.mainGroupsFound).toBe(true);
    for (const [name, pattern] of spanFreeReads()) expect(asked(pattern), name).toBe(PER_SPAN_FREE[name]);
  });

  it("the overview and Til overs for one span make one read of its transactions", async () => {
    const { load, loadLeftOver, transactionReads } = setUp();
    await load(JANUARY);
    const leftOver = await loadLeftOver(JANUARY);
    expect(transactionReads(JANUARY)).toBe(1);
    expect(leftOver.range).toEqual(JANUARY);
    expect(leftOver.months.map((m) => m.month)).toEqual(["2026-01"]);
  });

  it("Til overs first, then the overview, make one read too", async () => {
    const { load, loadLeftOver, transactionReads } = setUp();
    await loadLeftOver(JANUARY);
    await load(JANUARY);
    expect(transactionReads(JANUARY)).toBe(1);
  });

  it("both routes asked at once make one read of the span's transactions", async () => {
    const { load, loadLeftOver, transactionReads } = setUp();
    await Promise.all([load(JANUARY), loadLeftOver(JANUARY)]);
    expect(transactionReads(JANUARY)).toBe(1);
  });
});

const ONCE_SEED: SeedData = {
  accounts: [
    { name: "Fælles", active: true },
    { name: "Kassekredit", active: true },
  ],
  otherAccounts: [
    { name: "Anna", type: "revenue", active: true },
    { name: "Billån", type: "liabilities", active: true },
  ],
  categories: ["Dagligvarer", "Indskud"],
  ruleGroups: [
    {
      title: "Hovedgrupper",
      rules: [
        {
          title: "Dagligvarer",
          active: true,
          triggers: [{ type: "category_is", value: "Dagligvarer" }],
          actions: [{ type: "add_tag", value: "Mad" }],
        },
      ],
    },
  ],
  transactions: [
    {
      splits: [
        {
          type: "deposit",
          date: "2026-01-10",
          amount: "500.00",
          description: "Indskud",
          source: "Anna",
          destination: "Fælles",
          category: "Indskud",
        },
      ],
    },
  ],
};

describe("the warnings of Til overs", () => {
  it("logs the bucket warning once over two reads", async () => {
    const { load, loadLeftOver, warn } = setUp(undefined, { members: ["Anna"] }, ONCE_SEED);
    await loadLeftOver(JANUARY);
    await loadLeftOver({ start: "2026-01-01", end: "2026-01-30" });
    await load(JANUARY);
    const bucket = warn.mock.calls.filter(([message]) => String(message).includes("counts as spending"));
    expect(bucket).toHaveLength(1);
  });

  it("logs the setup check once per name over two reads", async () => {
    const options = {
      members: ["Anna", "Ukendt medlem"],
      savingsCategories: ["Ukendt opsparing"],
      creditAccounts: ["Ukendt kredit", "Billån", "Kassekredit"],
    };
    const { load, loadLeftOver, warn, clock } = setUp(undefined, options, ONCE_SEED);
    await load(JANUARY);
    clock.now = new Date(2026, 9, 31, 12);
    await loadLeftOver(FEBRUARY);
    const lines = warn.mock.calls.map(([message]) => String(message));
    const about = (name: string) => lines.filter((line) => line.includes(name));
    expect(about("Ukendt medlem")).toHaveLength(1);
    expect(about("Ukendt opsparing")).toHaveLength(1);
    expect(about("Ukendt kredit")).toHaveLength(1);
    expect(about("Billån")).toHaveLength(1);
    expect(about("Billån")[0]).toMatch(/liabilit/);
    expect(about("Ukendt kredit")[0]).not.toMatch(/liabilit/);
    expect(about("Kassekredit")).toHaveLength(0);
    expect(about("Anna")).toHaveLength(0);
  });
});
