import { createFakeFirefly, exampleSeed } from "@ha-spending/dev";
import { describe, expect, it } from "vitest";
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

function setUp(fail: (url: URL) => boolean = () => false) {
  const fake = createFakeFirefly(exampleSeed);
  const paths: string[] = [];
  const fetch: FetchLike = (input, init) => {
    const url = urlOf(input);
    paths.push(url.pathname);
    return fail(url) ? Promise.resolve(new Response("{}", { status: 500 })) : fake.fetch(input, init);
  };
  const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
  const clock = { now: new Date(2026, 9, 30, 12) };
  const load = createDataLoader(client, settings, () => clock.now, () => {});
  const asked = (pattern: RegExp) => paths.filter((path) => pattern.test(path)).length;
  return { load, clock, asked };
}

const SPAN_FREE = {
  rules: /^\/api\/v1\/rule-groups\/[^/]+\/rules$/,
  categories: /^\/api\/v1\/categories$/,
  accounts: /^\/api\/v1\/accounts$/,
  bills: /^\/api\/v1\/bills$/,
};

describe("createDataLoader", () => {
  it("two spans read in a row ask for the rules, categories, accounts and bills once", async () => {
    const { load, asked } = setUp();
    await load(JANUARY);
    const february = await load(FEBRUARY);
    for (const pattern of Object.values(SPAN_FREE)) expect(asked(pattern)).toBe(1);
    expect(february.postings.every((p) => p.date >= FEBRUARY.start && p.date <= FEBRUARY.end)).toBe(true);
    expect(february.categories.length).toBeGreaterThan(0);
  });

  it("a new day reads the span-free parts again", async () => {
    const { load, clock, asked } = setUp();
    await load(JANUARY);
    clock.now = new Date(2026, 9, 31, 0, 1);
    const march = await load(MARCH);
    for (const pattern of Object.values(SPAN_FREE)) expect(asked(pattern)).toBe(2);
    expect(march.today).toBe("2026-10-31");
  });

  it("after a failed read of the rules the next call asks for them again", async () => {
    let failures = 1;
    const { load, asked } = setUp((url) => SPAN_FREE.rules.test(url.pathname) && failures-- > 0);
    await expect(load(JANUARY)).rejects.toBeInstanceOf(FireflyError);
    const january = await load(JANUARY);
    expect(asked(SPAN_FREE.rules)).toBe(2);
    expect(january.mainGroupsFound).toBe(true);
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
    for (const pattern of Object.values(SPAN_FREE)) expect(asked(pattern)).toBe(1);
  });
});
