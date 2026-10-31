import { createFakeFirefly, type SeedData, type SeedRule, type SeedSplit } from "@ha-spending/dev";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient, type FetchLike } from "../src/firefly/client";
import type { WireCategory, WireGroup, WirePage, WireSplit } from "../src/firefly/wire";
import { createSorterApp } from "../src/sorter/http";
import { toOre } from "../src/firefly/amount";
import { createSorterTools, type SorterSettings } from "../src/sorter/tools";

const KEY = "made-up-sorter-key-made-up-sorter-key";

const SETTINGS: SorterSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  inboxCategory: "Til sortering",
  pageSize: 3,
  timeoutMs: 1000,
};

function tagRule(category: string, tag: string): SeedRule {
  return {
    title: `${category} → ${tag}`,
    active: true,
    triggers: [{ type: "category_is", value: category }],
    actions: [{ type: "add_tag", value: tag }],
  };
}

const one = (split: SeedSplit) => ({ splits: [split] });

/** Made up. The inbox, oldest first: Kiosk, Returvare Butik B, Indkøb i Butik A, Del 1, Del 2. */
const seed: SeedData = {
  accounts: [
    { name: "Konto A", active: true },
    { name: "Konto B", active: true },
  ],
  categories: ["Dagligvarer", "Mad: Øvrige", "Husleje", "Indskud", "Til sortering", "Gammel"],
  ruleGroups: [
    {
      title: "Hovedgrupper",
      rules: [
        tagRule("Dagligvarer", "Mad"),
        tagRule("Mad: Øvrige", "Mad"),
        tagRule("Husleje", "Bolig"),
        tagRule("Indskud", "Penge ind og ud"),
        tagRule("Til sortering", "Til sortering"),
      ],
    },
  ],
  transactions: [
    one({ type: "withdrawal", date: "2026-03-02", amount: "412.50", description: "Indkøb i Butik A",
      source: "Konto A", destination: "Butik A", notes: "Banken: Dagligvarer", tags: ["Kvittering"] }),
    one({ type: "deposit", date: "2026-03-01", amount: "50.25", description: "Returvare Butik B",
      source: "Butik B", destination: "Konto B", category: "Til sortering", tags: ["Til sortering"] }),
    one({ type: "withdrawal", date: "2026-03-03", amount: "8000.00", description: "Husleje marts",
      source: "Konto A", destination: "Udlejer", category: "Husleje", tags: ["Bolig"] }),
    one({ type: "transfer", date: "2026-02-01", amount: "300.00", description: "Overførsel",
      source: "Konto A", destination: "Konto B" }),
    {
      groupTitle: "Indkøb",
      splits: [
        { type: "withdrawal", date: "2026-03-04", amount: "100.00", description: "Del 1",
          source: "Konto A", destination: "Butik C" },
        { type: "withdrawal", date: "2026-03-04", amount: "50.00", description: "Del 2",
          source: "Konto A", destination: "Butik C", tags: ["Ferie"] },
      ],
    },
    one({ type: "withdrawal", date: "2026-02-15", amount: "45.00", description: "Kiosk",
      source: "Konto A", destination: "Kiosk", tags: ["Bolig", "Ferie"] }),
    one({ type: "deposit", date: "2026-01-10", amount: "5000.00", description: "Indskud fra familien",
      source: "Familien", destination: "Konto A", category: "Indskud" }),
  ],
};

const TEXTS = ["Kiosk", "Butik", "Husleje marts", "Del 1", "Del 2", "Banken", "412", KEY];

const TREE = [
  { name: "Dagligvarer", group: "Mad" },
  { name: "Mad: Øvrige", group: "Mad" },
  { name: "Husleje", group: "Bolig" },
];

interface Result {
  isError: boolean;
  value: Record<string, unknown>;
}

function setup(options: { data?: SeedData; settings?: Partial<SorterSettings>; fetch?: (f: FetchLike) => FetchLike } = {}) {
  const fake = createFakeFirefly(options.data ?? seed);
  const fetch = options.fetch ? options.fetch(fake.fetch) : fake.fetch;
  const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
  const direct = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
  const log = vi.fn();
  const tools = createSorterTools(client, { ...SETTINGS, ...options.settings }, log);
  const app = createSorterApp({ key: KEY, tools, log });

  async function call(name: string, args: unknown): Promise<Result> {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { content: { type: string; text: string }[]; isError?: boolean } };
    expect(body.result.content[0].type).toBe("text");
    return { isError: body.result.isError === true, value: JSON.parse(body.result.content[0].text) };
  }

  async function categoryIds(): Promise<Map<string, number>> {
    const page = (await direct.get("categories", { limit: "500" })) as WirePage<WireCategory>;
    return new Map(page.data.map((c) => [c.attributes.name, Number(c.id)]));
  }

  async function splits(): Promise<Map<string, WireSplit & { groupId: string }>> {
    const query = { start: "1900-01-01", end: "2100-01-01", type: "all", limit: "500" };
    const page = (await direct.get("transactions", query)) as WirePage<WireGroup>;
    return new Map(
      page.data.flatMap((g) => g.attributes.transactions.map((s) => [s.description, { ...s, groupId: g.id }])),
    );
  }

  const postingId = async (description: string) => Number((await splits()).get(description)!.transaction_journal_id);

  async function tree() {
    const ids = await categoryIds();
    return TREE.map((c) => ({ id: ids.get(c.name)!, ...c }));
  }

  const puts = () => fake.requests.filter((r) => r.method === "PUT");
  const posts = () => fake.requests.filter((r) => r.method === "POST");

  async function accounts(): Promise<{ id: string; name: string; type: string; active: boolean }[]> {
    type Account = { id: string; attributes: { name: string; type: string; active: boolean } };
    const page = (await direct.get("accounts", { type: "all", limit: "500" })) as WirePage<Account>;
    return page.data.map(({ id, attributes: { name, type, active } }) => ({ id, name, type, active }));
  }

  /** The amount of a posting as `start` gives it. */
  async function amountOf(postingId: number): Promise<string> {
    const split = [...(await splits()).values()].find((x) => Number(x.transaction_journal_id) === postingId);
    const ore = split === undefined ? 100 : Math.abs(toOre(split.amount));
    return `${Math.trunc(ore / 100)}.${String(ore % 100).padStart(2, "0")}`;
  }

  /** The sorter's path: `start` gives the inbox out, then `set_category` with each posting's amount. */
  async function write(
    assignments: { posting_id: number; category_id: number; shop?: unknown }[],
    categories?: { id: number; name: string; group: string }[],
  ): Promise<Result> {
    const started = await call("start", { categories: categories ?? (await tree()) });
    expect(started.value.ok).toBe(true);
    const withAmounts = await Promise.all(assignments.map(async (x) => ({ ...x, amount: await amountOf(x.posting_id) })));
    return call("set_category", { assignments: withAmounts });
  }

  function logsNoPosting() {
    for (const line of log.mock.calls.flat().map(String)) for (const text of TEXTS) expect(line).not.toContain(text);
  }

  function logsNoShop(...names: string[]) {
    for (const line of log.mock.calls.flat().map(String)) for (const name of names) expect(line).not.toContain(name);
  }

  return { fake, direct, log, call, categoryIds, splits, postingId, tree, puts, posts, accounts, logsNoPosting,
    logsNoShop, amountOf, write };
}

describe("start", () => {
  it("answers the inbox, oldest first, when the categories match Firefly III", async () => {
    const s = setup();
    const { isError, value } = await s.call("start", { categories: await s.tree() });
    expect(isError).toBe(false);
    expect(value.ok).toBe(true);
    const postings = value.postings as Record<string, unknown>[];
    expect(postings.map((p) => p.description)).toEqual([
      "Kiosk",
      "Returvare Butik B",
      "Indkøb i Butik A",
      "Del 1",
      "Del 2",
    ]);
    expect(postings[0]).toEqual({
      posting_id: await s.postingId("Kiosk"),
      date: "2026-02-15",
      description: "Kiosk",
      amount: "45.00",
      type: "withdrawal",
      account: "Konto A",
      notes: null,
    });
    expect(postings[1]).toMatchObject({ type: "deposit", account: "Konto B", amount: "50.25" });
    expect(postings[2]).toMatchObject({ amount: "412.50", notes: "Banken: Dagligvarer" });
    s.logsNoPosting();
    expect(s.log).toHaveBeenCalledWith("sorter: start: ok, 5 postings");
  });

  it("answers at most 50 postings, the oldest, and says when there are more", async () => {
    const day = (n: number) => new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10);
    const transactions = Array.from({ length: 51 }, (_, n) =>
      one({ type: "withdrawal" as const, date: day(n), amount: "1.00", description: `Køb ${n}`,
        source: "Konto A", destination: "Butik" }),
    );
    const s = setup({ data: { ...seed, transactions }, settings: { pageSize: 40 } });
    const { value } = await s.call("start", { categories: await s.tree() });
    const postings = value.postings as { date: string }[];
    expect(postings).toHaveLength(50);
    expect(postings[0].date).toBe(day(0));
    expect(postings[49].date).toBe(day(49));
    expect(value.more).toBe(true);
  });

  it("says there are no more when the whole inbox fits", async () => {
    const day = (n: number) => new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10);
    const transactions = Array.from({ length: 50 }, (_, n) =>
      one({ type: "withdrawal" as const, date: day(n), amount: "1.00", description: `Køb ${n}`,
        source: "Konto A", destination: "Butik" }),
    );
    const s = setup({ data: { ...seed, transactions }, settings: { pageSize: 40 } });
    const { value } = await s.call("start", { categories: await s.tree() });
    expect(value.postings).toHaveLength(50);
    expect(value.more).toBe(false);
  });

  it("keeps a full answer small enough for the agent to take in one tool result", async () => {
    // Claude Code saves a tool result over about 25,000 tokens to a file instead, which the sorter may not read.
    // Bank-like text tokenizes badly: digits, codes, quotes and line breaks, which JSON escapes.
    const text = 'MobilePay "Ref 4711-0815"\\n'.repeat(20);
    const transactions = Array.from({ length: 100 }, (_, n) =>
      one({ type: "withdrawal" as const, date: "2025-01-01", amount: "1234567.89", description: text, notes: text,
        source: "Konto A", destination: `Butik ${n}` }),
    );
    const s = setup({ data: { ...seed, transactions }, settings: { pageSize: 40 } });
    const { value } = await s.call("start", { categories: await s.tree() });
    expect(JSON.stringify(value).length).toBeLessThan(50_000);
    const first = (value.postings as { description: string; notes: string }[])[0];
    expect(Array.from(first.description)).toHaveLength(150);
    expect(first.description.endsWith("…")).toBe(true);
    expect(Array.from(first.notes)).toHaveLength(150);
  });

  it("never cuts an emoji in half", async () => {
    const text = `${"a".repeat(148)}😀${"b".repeat(10)}`;
    const s = setup({
      data: { ...seed, transactions: [one({ type: "withdrawal" as const, date: "2025-01-01", amount: "1.00",
        description: text, source: "Konto A", destination: "Butik" })] },
    });
    const { value } = await s.call("start", { categories: await s.tree() });
    const description = (value.postings as { description: string }[])[0].description;
    expect(description).toBe(`${"a".repeat(148)}😀…`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(description)).toBe(false);
  });

  it.each([
    ["a category renamed in Firefly III", (t: Tree) => t.map((c) => c.name === "Dagligvarer" ? { ...c, name: "Mad og drikke" } : c), ['"Dagligvarer"', '"Mad og drikke"']],
    ["a wrong main group", (t: Tree) => t.map((c) => c.name === "Husleje" ? { ...c, group: "Mad" } : c), ['"Husleje"', '"Bolig"']],
    ["a missing category", (t: Tree) => t.filter((c) => c.name !== "Mad: Øvrige"), ['"Mad: Øvrige"', "missing"]],
    ["an id Firefly III does not have", (t: Tree) => [...t, { id: 9999, name: "Ny", group: "Mad" }], ["9999"]],
    ["an id given twice", (t: Tree) => [...t, t[0]], ["more than once"]],
  ])("answers a problem and no postings for %s", async (_, change, words) => {
    const s = setup();
    const { isError, value } = await s.call("start", { categories: change(await s.tree()) });
    expect(isError).toBe(false);
    expect(value).toEqual({ ok: false, problems: [expect.any(String)] });
    for (const word of words) expect((value.problems as string[])[0]).toContain(word);
    expect(s.fake.requests.some((r) => r.path.includes("/search/"))).toBe(false);
  });

  it.each([
    ["the inbox", "Til sortering", "Til sortering", "inbox"],
    ["a category in an excluded main group", "Indskud", "Penge ind og ud", "excluded"],
    ["a category in no main group", "Gammel", "Mad", "no main group"],
  ])("answers a problem for %s in the list", async (_, name, group, word) => {
    const s = setup();
    const ids = await s.categoryIds();
    const { value } = await s.call("start", { categories: [...(await s.tree()), { id: ids.get(name)!, name, group }] });
    expect(value.ok).toBe(false);
    expect(value.problems).toEqual([expect.stringContaining(word)]);
    expect(value.postings).toBeUndefined();
  });

  it("answers a problem when the rule group maps a name that is not a category in Firefly III", async () => {
    const ghost = { ...seed, ruleGroups: [{ title: "Hovedgrupper", rules: [...seed.ruleGroups[0].rules,
      tagRule("Findes ikke", "Mad")] }] };
    const s = setup({ data: ghost });
    const { value } = await s.call("start", { categories: await s.tree() });
    expect(value).toEqual({
      ok: false,
      problems: ['"Findes ikke" is in the rule group but not a category in Firefly III'],
    });
  });

  it("answers a problem when the rule group is missing or maps a category twice", async () => {
    const missing = setup({ settings: { mainGroupRuleGroup: "Ingen" } });
    const answer = await missing.call("start", { categories: [] });
    expect(answer.value.ok).toBe(false);
    expect(answer.value.problems).toEqual([expect.stringContaining('"Ingen"')]);

    const twice = { ...seed, ruleGroups: [{ title: "Hovedgrupper", rules: [...seed.ruleGroups[0].rules,
      tagRule("Husleje", "Mad")] }] };
    const s = setup({ data: twice });
    const tree = (await s.tree()).map((c) => (c.name === "Husleje" ? { ...c, group: "Mad" } : c));
    const { value } = await s.call("start", { categories: tree });
    expect(value.problems).toEqual([expect.stringContaining('"Husleje" is in more than one main group')]);
  });

  it.each([{}, { categories: "all" }, { categories: [{ id: "1", name: "Dagligvarer", group: "Mad" }] },
    { categories: [{ id: 1.5, name: "Dagligvarer", group: "Mad" }] }])("refuses the arguments %j", async (args) => {
    const s = setup();
    expect(await s.call("start", args)).toEqual({ isError: true, value: { error: "bad-arguments" } });
    expect(s.fake.requests).toHaveLength(0);
  });

  it.each([
    ["error", "unreachable"],
    ["refused", "refused"],
    ["slow", "unreachable"],
  ] as const)("answers a tool error when Firefly III is %s", async (fault, code) => {
    const s = setup({ settings: { timeoutMs: 50 } });
    const categories = await s.tree();
    s.fake.fault = fault;
    expect(await s.call("start", { categories })).toEqual({ isError: true, value: { error: code } });
    expect(s.log).toHaveBeenCalledWith(`sorter: start: ${code}`);
  });
});

type Tree = { id: number; name: string; group: string }[];

describe("set_category", () => {
  it("writes the category and its main group's tag, keeps the other tags, and changes nothing else", async () => {
    const s = setup();
    const before = (await s.splits()).get("Kiosk")!;
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const posting = Number(before.transaction_journal_id);

    const answer = await s.write([{ posting_id: posting, category_id: food }]);
    expect(answer).toEqual({ isError: false, value: { results: [{ posting_id: posting, ok: true }] } });

    const after = (await s.splits()).get("Kiosk")!;
    expect(after).toEqual({ ...before, category_id: String(food), category_name: "Dagligvarer", tags: ["Ferie", "Mad"] });
    expect(s.puts()).toEqual([
      {
        method: "PUT",
        path: `/api/v1/transactions/${before.groupId}`,
        body: {
          apply_rules: false,
          transactions: [{ transaction_journal_id: String(posting), category_id: String(food), tags: ["Ferie", "Mad"] }],
        },
      },
    ]);
    s.logsNoPosting();
    expect(s.log).toHaveBeenCalledWith("sorter: set_category: 1 written");
  });

  it("removes another main group's tag too", async () => {
    const other = {
      ...seed,
      ruleGroups: [{ title: "Hovedgrupper", rules: [...seed.ruleGroups[0].rules, tagRule("Gammel", "Fritid")] }],
      transactions: [one({ type: "withdrawal" as const, date: "2026-02-15", amount: "45.00", description: "Kiosk",
        source: "Konto A", destination: "Kiosk", tags: ["Fritid", "Ferie"] })],
    };
    const s = setup({ data: other });
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const old = { id: (await s.categoryIds()).get("Gammel")!, name: "Gammel", group: "Fritid" };
    const { value } = await s.write([{ posting_id: kiosk, category_id: food }], [...(await s.tree()), old]);
    expect(value.results).toEqual([{ posting_id: kiosk, ok: true }]);
    expect((await s.splits()).get("Kiosk")!.tags).toEqual(["Ferie", "Mad"]);
  });

  it("takes a posting out of the inbox category and replaces its main group tag", async () => {
    const s = setup();
    const posting = await s.postingId("Returvare Butik B");
    const rent = (await s.categoryIds()).get("Husleje")!;
    const { value } = await s.write([{ posting_id: posting, category_id: rent }]);
    expect(value.results).toEqual([{ posting_id: posting, ok: true }]);
    expect((await s.splits()).get("Returvare Butik B")).toMatchObject({ category_name: "Husleje", tags: ["Bolig"] });
  });

  it("keeps the other splits of a split group", async () => {
    const s = setup();
    const before = await s.splits();
    const first = Number(before.get("Del 1")!.transaction_journal_id);
    const other = (await s.categoryIds()).get("Mad: Øvrige")!;
    const { value } = await s.write([{ posting_id: first, category_id: other }]);
    expect(value.results).toEqual([{ posting_id: first, ok: true }]);
    const after = await s.splits();
    expect(after.get("Del 1")).toMatchObject({ category_name: "Mad: Øvrige", tags: ["Mad"] });
    expect(after.get("Del 2")).toEqual(before.get("Del 2"));
    expect(s.puts()[0].body).toMatchObject({ group_title: "Indkøb" });
  });

  it("answers each assignment of a batch on its own, in order", async () => {
    const s = setup();
    const ids = await s.categoryIds();
    const kiosk = await s.postingId("Kiosk");
    const rent = await s.postingId("Husleje marts");
    const { isError, value } = await s.write([
      { posting_id: rent, category_id: ids.get("Dagligvarer")! },
      { posting_id: kiosk, category_id: ids.get("Dagligvarer")! },
    ]);
    expect(isError).toBe(false);
    expect(value.results).toEqual([
      { posting_id: rent, ok: false, reason: "not-in-inbox" },
      { posting_id: kiosk, ok: true },
    ]);
    const after = await s.splits();
    expect(after.get("Husleje marts")).toMatchObject({ category_name: "Husleje", tags: ["Bolig"] });
    expect(after.get("Kiosk")).toMatchObject({ category_name: "Dagligvarer" });
    expect(s.log).toHaveBeenCalledWith("sorter: set_category: 1 written, refused 1 not-in-inbox");
  });

  it.each([
    ["a posting already sorted", "Husleje marts", "Dagligvarer", "not-in-inbox"],
    ["a transfer", "Overførsel", "Dagligvarer", "transfer"],
    ["a category in no main group", "Kiosk", "Gammel", "no-main-group"],
    ["a category in an excluded main group", "Kiosk", "Indskud", "excluded-main-group"],
    ["the inbox category", "Kiosk", "Til sortering", "inbox-category"],
  ])("refuses %s", async (_, description, category, reason) => {
    const s = setup();
    const before = await s.splits();
    const posting = Number(before.get(description)!.transaction_journal_id);
    const categoryId = (await s.categoryIds()).get(category)!;
    const { value } = await s.write([{ posting_id: posting, category_id: categoryId }]);
    expect(value.results).toEqual([{ posting_id: posting, ok: false, reason }]);
    expect(s.puts()).toEqual([]);
    expect(await s.splits()).toEqual(before);
  });

  it("refuses a posting that is neither a withdrawal nor a deposit", async () => {
    const s = setup({
      fetch: (fetch) => async (input, init) => {
        const res = await fetch(input, init);
        const url = new URL(input instanceof Request ? input.url : input);
        if (!url.pathname.includes("/search/") && !/\/transactions\/[0-9]+$/.test(url.pathname)) return res;
        // Firefly III also has opening balances and reconciliations, which the fake does not make.
        const text = (await res.text()).replaceAll('"type":"withdrawal"', '"type":"opening balance"');
        return new Response(text, { status: res.status, headers: res.headers });
      },
    });
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const { value } = await s.write([{ posting_id: kiosk, category_id: food }]);
    expect(value.results).toEqual([{ posting_id: kiosk, ok: false, reason: "not-withdrawal-or-deposit" }]);
    expect(s.puts()).toEqual([]);
  });

  it("refuses a posting or a category Firefly III does not have", async () => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const { value } = await s.write([
      { posting_id: 99999, category_id: food },
      { posting_id: kiosk, category_id: 99999 },
    ]);
    expect(value.results).toEqual([
      { posting_id: 99999, ok: false, reason: "unknown-posting" },
      { posting_id: kiosk, ok: false, reason: "unknown-category" },
    ]);
    expect(s.puts()).toEqual([]);
  });

  it("refuses a category the rule group maps to two main groups", async () => {
    const twice = { ...seed, ruleGroups: [{ title: "Hovedgrupper", rules: [...seed.ruleGroups[0].rules,
      tagRule("Dagligvarer", "Bolig")] }] };
    const s = setup({ data: twice });
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    // start refuses while a category is in two main groups; set_category checks the category first, too.
    const { value } = await s.call("set_category", { assignments: [{ posting_id: kiosk, category_id: food, amount: "45.00" }] });
    expect(value.results).toEqual([{ posting_id: kiosk, ok: false, reason: "ambiguous-main-group" }]);
    expect(s.puts()).toEqual([]);
  });

  it("never overwrites a hand correction made since start", async () => {
    const s = setup();
    const ids = await s.categoryIds();
    const { value } = await s.call("start", { categories: await s.tree() });
    const shop = (value.postings as { posting_id: number; description: string; amount: string }[])
      .find((p) => p.description === "Indkøb i Butik A")!;
    const split = (await s.splits()).get("Indkøb i Butik A")!;
    await s.direct.put(`transactions/${split.groupId}`, {
      transactions: [{ transaction_journal_id: split.transaction_journal_id, category_id: String(ids.get("Husleje")) }],
    });

    const answer = await s.call("set_category", {
      assignments: [{ posting_id: shop.posting_id, category_id: ids.get("Dagligvarer")!, amount: shop.amount }],
    });
    expect(answer.value.results).toEqual([{ posting_id: shop.posting_id, ok: false, reason: "not-in-inbox" }]);
    expect((await s.splits()).get("Indkøb i Butik A")!.category_name).toBe("Husleje");
    expect(s.puts()).toHaveLength(1);
  });

  it("refuses a posting start has not given out, though it is in the inbox", async () => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const { value } = await s.call("set_category", { assignments: [{ posting_id: kiosk, category_id: food, amount: "45.00" }] });
    expect(value.results).toEqual([{ posting_id: kiosk, ok: false, reason: "not-given-out" }]);
    expect(s.puts()).toEqual([]);
  });

  it("refuses a posting whose amount is not the one start gave, as when its id is copied wrong", async () => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const shop = await s.postingId("Indkøb i Butik A");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    await s.call("start", { categories: await s.tree() });
    const { value } = await s.call("set_category", {
      assignments: [
        { posting_id: shop, category_id: food, amount: "45.00" },
        { posting_id: kiosk, category_id: food, amount: "45.00" },
      ],
    });
    expect(value.results).toEqual([
      { posting_id: shop, ok: false, reason: "amount-mismatch" },
      { posting_id: kiosk, ok: true },
    ]);
    expect(s.puts()).toHaveLength(1);
    expect((await s.splits()).get("Indkøb i Butik A")!.category_name).toBeNull();
  });

  it("takes a posting 30 minutes after start gave it out, and not later", async () => {
    let clock = 1_000_000;
    const fake = createFakeFirefly(seed);
    const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
    const tools = createSorterTools(client, SETTINGS, vi.fn(), () => clock);
    const [start, setCategory] = tools;
    const categories = await setup().tree();
    const { postings } = (await start.call({ categories })) as { postings: { posting_id: number; amount: string }[] };
    const [first, second] = postings;
    const food = categories.find((c) => c.name === "Dagligvarer")!.id;
    clock += 30 * 60 * 1000 - 1;
    expect(await setCategory.call({ assignments: [{ posting_id: first.posting_id, category_id: food, amount: first.amount }] }))
      .toEqual({ results: [{ posting_id: first.posting_id, ok: true }] });
    clock += 1;
    expect(await setCategory.call({ assignments: [{ posting_id: second.posting_id, category_id: food, amount: second.amount }] }))
      .toEqual({ results: [{ posting_id: second.posting_id, ok: false, reason: "not-given-out" }] });
  });

  it.each([
    ["an empty list", () => []],
    ["more than 100 assignments", (p: number, c: number) => Array.from({ length: 101 }, (_, n) =>
      ({ posting_id: n === 0 ? p : 100000 + n, category_id: c, amount: "45.00" }))],
    ["a posting given twice", (p: number, c: number) => [{ posting_id: p, category_id: c, amount: "45.00" },
      { posting_id: p, category_id: c, amount: "45.00" }]],
    ["an id that is not a whole number", (p: number) => [{ posting_id: p, category_id: "1", amount: "45.00" }]],
    ["no amount", (p: number, c: number) => [{ posting_id: p, category_id: c }]],
    ["an amount as a number", (p: number, c: number) => [{ posting_id: p, category_id: c, amount: 45 }]],
    ["an amount with a sign", (p: number, c: number) => [{ posting_id: p, category_id: c, amount: "-45.00" }]],
  ])("refuses %s whole, and writes nothing", async (_, assignments) => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    s.fake.requests.length = 0;
    const { isError, value } = await s.call("set_category", { assignments: assignments(kiosk, food) });
    expect(isError).toBe(true);
    expect(value).toEqual({ error: "bad-arguments", reason: expect.any(String) });
    expect(s.fake.requests).toEqual([]);
  });

  it("answers a tool error and writes nothing when Firefly III does not answer", async () => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    await s.call("start", { categories: await s.tree() });
    s.fake.fault = "error";
    const answer = await s.call("set_category", { assignments: [{ posting_id: kiosk, category_id: food, amount: "45.00" }] });
    expect(answer).toEqual({ isError: true, value: { error: "unreachable", results: [] } });
    expect(s.puts()).toEqual([]);
    expect(s.log).toHaveBeenCalledWith("sorter: set_category: unreachable");
  });

  it("stops a batch at a failed write, and tells what was written before it", async () => {
    let writes = 0;
    const s = setup({
      fetch: (fetch) => (input, init) => {
        if (init?.method === "PUT" && ++writes === 2) return Promise.reject(new TypeError("fetch failed"));
        return fetch(input, init);
      },
    });
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const ids = await Promise.all(["Kiosk", "Indkøb i Butik A", "Del 1"].map(s.postingId));
    const answer = await s.write(ids.map((posting_id) => ({ posting_id, category_id: food })));
    expect(answer).toEqual({
      isError: true,
      value: { error: "unreachable", results: [{ posting_id: ids[0], ok: true }] },
    });
    expect(writes).toBe(2);
    const after = await s.splits();
    expect(after.get("Kiosk")!.category_name).toBe("Dagligvarer");
    expect(after.get("Del 1")!.category_name).toBeNull();
    s.logsNoPosting();
  });
});

// Built from code points so no invisible or non-ASCII character sits in these tests.
const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const CAFE_NFC = "Caf" + cp(0xe9);
const CAFE_NFD = "Cafe" + cp(0x301);
const GRINNING_FACE = cp(0x1f600);
const REPLACEMENT = cp(0xfffd);
const BIDI_OVERRIDE = cp(0x202e);
const ZERO_WIDTH_SPACE = cp(0x200b);
const LINE_SEPARATOR = cp(0x2028);
const LONE_SURROGATE = cp(0xd800);

/** Made up. Card payments with no counterparty land on `(no name)`, as a bank file's import leaves them. */
const shopSeed: SeedData = {
  ...seed,
  otherAccounts: [
    // Listed before "Bager", so the order of the ids is not the order of the code points.
    { name: "bager", type: "expense", active: true },
    { name: "Bager", type: "expense", active: true },
    { name: "Gammel butik", type: "expense", active: false },
    { name: "Billaan", type: "liabilities", active: true },
    { name: "Loen", type: "revenue", active: true },
  ],
  transactions: [
    ...seed.transactions,
    ...[1, 2, 3].map((n) => one({ type: "withdrawal" as const, date: `2026-03-0${4 + n}`, amount: `${n}0.00`,
      description: `Kort ${n}`, source: "Konto A" })),
    one({ type: "deposit", date: "2026-03-05", amount: "15.00", description: "Retur", source: "(no name)",
      destination: "Konto B" }),
    {
      groupTitle: "Kort i alt",
      splits: [
        { type: "withdrawal", date: "2026-03-08", amount: "5.00", description: "Kort del 1", source: "Konto A" },
        { type: "withdrawal", date: "2026-03-08", amount: "6.00", description: "Kort del 2", source: "Konto A" },
      ],
    },
  ],
};

type Setup = ReturnType<typeof setup>;

/** `start`, then `set_category` for the postings named by description, each with its shop when one is given. */
async function writeShops(s: Setup, entries: { description: string; shop?: unknown; category?: string }[]) {
  const ids = await s.categoryIds();
  const assignments = await Promise.all(entries.map(async (e) => ({
    posting_id: await s.postingId(e.description),
    category_id: ids.get(e.category ?? "Dagligvarer")!,
    ...("shop" in e ? { shop: e.shop } : {}),
  })));
  return { postings: assignments.map((a) => a.posting_id), answer: await s.write(assignments) };
}

describe("start's shops", () => {
  it("answers the active expense accounts' names, cleaned, each once, in code-point order, over several pages", async () => {
    const extra = [" Kiosk 2 ", "Zebra", CAFE_NFD, CAFE_NFC, GRINNING_FACE + " Smil", REPLACEMENT + " Tegn",
      "Skjult" + ZERO_WIDTH_SPACE + "navn", "(No Name)", "x".repeat(61)];
    const data: SeedData = { ...shopSeed, otherAccounts: [...shopSeed.otherAccounts!,
      ...extra.map((name) => ({ name, type: "expense" as const, active: true }))] };
    const s = setup({ data });
    const { value } = await s.call("start", { categories: await s.tree() });
    expect(value.ok).toBe(true);
    expect(value.shops).toEqual(["Bager", "Butik A", "Butik C", CAFE_NFC, "Kiosk", "Kiosk 2", "Udlejer", "Zebra",
      "bager", REPLACEMENT + " Tegn", GRINNING_FACE + " Smil"]);
    expect(value.shops_more).toBe(false);
    expect(s.fake.requests.filter((r) => r.path === "/api/v1/accounts").length).toBeGreaterThan(1);
  });

  it("stops the shops before 12,000 code points, at a whole name, and says names were left out", async () => {
    // 60 code points but 61 UTF-16 units each: 200 of them fill 12,000 code points exactly.
    const long = (n: number) => `Butik ${String(n).padStart(3, "0")} `.padEnd(59, "x") + GRINNING_FACE;
    const names = Array.from({ length: 250 }, (_, n) => long(n));
    const otherAccounts = names.map((name) => ({ name, type: "expense" as const, active: true }));
    const s = setup({ data: { ...seed, otherAccounts }, settings: { pageSize: 100 } });
    const { value } = await s.call("start", { categories: await s.tree() });
    // Every name here starts in ASCII and differs there, so the default order is the code-point order.
    const all = ["Butik A", "Butik C", "Kiosk", "Udlejer", ...names].sort();
    const shops = value.shops as string[];
    const size = (list: string[]) => list.reduce((n, name) => n + Array.from(name).length, 0);
    expect(shops).toHaveLength(200);
    expect(shops).toEqual(all.slice(0, shops.length));
    expect(size(shops)).toBeLessThanOrEqual(12_000);
    expect(size(all.slice(0, shops.length + 1))).toBeGreaterThan(12_000);
    expect(value.shops_more).toBe(true);
  });

  it("gives no shops with a problem", async () => {
    const s = setup({ data: shopSeed });
    const { value } = await s.call("start", { categories: (await s.tree()).slice(1) });
    expect(value.ok).toBe(false);
    expect(value).not.toHaveProperty("shops");
    expect(value).not.toHaveProperty("shops_more");
  });
});

describe("set_category with a shop", () => {
  it("makes a new shop's expense account and writes it by id, on a withdrawal on (no name)", async () => {
    const s = setup({ data: shopSeed });
    const before = (await s.splits()).get("Kort 1")!;
    expect(before).toMatchObject({ destination_name: "(no name)", destination_type: "Expense account" });
    const accountsBefore = await s.accounts();
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const posting = Number(before.transaction_journal_id);

    const { value } = await s.write([{ posting_id: posting, category_id: food, shop: "  Ny butik " }]);
    expect(value.results).toEqual([{ posting_id: posting, ok: true, shop: "Ny butik" }]);

    const made = (await s.accounts()).filter((a) => !accountsBefore.some((b) => b.id === a.id));
    expect(made).toEqual([{ id: expect.any(String), name: "Ny butik", type: "expense", active: true }]);
    expect(s.posts()).toEqual([{ method: "POST", path: "/api/v1/accounts", body: { name: "Ny butik", type: "expense" } }]);
    expect((await s.splits()).get("Kort 1")).toEqual({ ...before, category_id: String(food),
      category_name: "Dagligvarer", tags: ["Mad"], destination_id: made[0].id, destination_name: "Ny butik" });
    expect(s.puts().map((p) => p.body)).toEqual([{ apply_rules: false, transactions: [{
      transaction_journal_id: String(posting), category_id: String(food), tags: ["Mad"], destination_id: made[0].id }] }]);
    s.logsNoShop("Ny butik");
  });

  it("stops the batch as unreachable when Firefly III refuses the new account, and leaves the posting", async () => {
    const s = setup({
      data: shopSeed,
      fetch: (fetch) => (input, init) => {
        if (init?.method === "POST") return Promise.resolve(Response.json({ message: "Taken.", errors: {} }, { status: 422 }));
        return fetch(input, init);
      },
    });
    const before = await s.splits();
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1", shop: "Butik A" },
      { description: "Kort 2", shop: "Ny butik" },
      { description: "Kort 3" },
    ]);
    // The earlier results stand, but a failure's detail never holds a shop's name.
    expect(answer).toEqual({ isError: true, value: { error: "unreachable", results: [{ posting_id: postings[0], ok: true }] } });
    const after = await s.splits();
    expect(after.get("Kort 1")).toMatchObject({ category_name: "Dagligvarer", destination_name: "Butik A" });
    expect(after.get("Kort 2")).toEqual(before.get("Kort 2"));
    expect(after.get("Kort 3")).toEqual(before.get("Kort 3"));
    expect(s.puts()).toHaveLength(1);
    s.logsNoShop("Butik A", "Ny butik");
  });

  it.each([
    ["a liability", { type: "liabilities", active: true }],
    ["an inactive expense account", { type: "expense", active: false }],
    ["an account of no type", { active: true }],
    ["an expense account that does not say it is active", { type: "expense" }],
  ])("stops the batch as unreachable when the new account comes back as %s, and leaves the posting", async (_, kind) => {
    const s = setup({
      data: shopSeed,
      fetch: (fetch) => (input, init) => {
        if (init?.method !== "POST") return fetch(input, init);
        return Promise.resolve(Response.json({ data: { id: "9999", attributes: { name: "Ny butik", ...kind } } }));
      },
    });
    const before = await s.splits();
    const { answer } = await writeShops(s, [
      { description: "Kort 1", shop: "Ny butik" },
      { description: "Kort 2" },
    ]);
    expect(answer).toEqual({ isError: true, value: { error: "unreachable", results: [] } });
    expect(s.puts()).toEqual([]);
    expect(await s.splits()).toEqual(before);
    s.logsNoShop("Ny butik");
  });

  it("reads the accounts once per call", async () => {
    const s = setup({ data: shopSeed });
    const pages = Math.ceil((await s.accounts()).length / SETTINGS.pageSize);
    const ids = await s.categoryIds();
    await s.call("start", { categories: await s.tree() });
    const assignments = await Promise.all([["Kort 1", "Ny butik"], ["Kort 2", "NY BUTIK"], ["Kort 3", "Bager"]].map(
      async ([description, shop]) => {
        const posting_id = await s.postingId(description);
        return { posting_id, category_id: ids.get("Dagligvarer")!, amount: await s.amountOf(posting_id), shop };
      }));
    const start = s.fake.requests.length;
    const { value } = await s.call("set_category", { assignments });
    expect((value.results as unknown[]).length).toBe(3);
    expect(pages).toBeGreaterThan(1);
    const reads = s.fake.requests.slice(start).filter((r) => r.method === "GET" && r.path === "/api/v1/accounts");
    expect(reads).toHaveLength(pages);
  });

  it.each([
    ["not-withdrawal", "a deposit whose source is (no name)", "Retur", "Ny butik"],
    ["not-withdrawal", "a deposit, before the name", "Retur", "(no name)"],
    ["has-shop", "a withdrawal whose shop was set by hand", "Kiosk", "Ny butik"],
    ["has-shop", "a shop set by hand, before the name", "Kiosk", "(no name)"],
    ["has-shop", "a shop set by hand, before the other accounts", "Kiosk", "Billaan"],
    ["bad-shop-name", "an empty name", "Kort 1", ""],
    ["bad-shop-name", "only spaces", "Kort 1", "   "],
    ["bad-shop-name", "a line feed", "Kort 1", "Ny\nbutik"],
    ["bad-shop-name", "a bidi override", "Kort 1", "Ny" + BIDI_OVERRIDE + "butik"],
    ["bad-shop-name", "a zero-width space", "Kort 1", "Ny" + ZERO_WIDTH_SPACE + "butik"],
    ["bad-shop-name", "a line separator", "Kort 1", "Ny" + LINE_SEPARATOR + "butik"],
    ["bad-shop-name", "a lone surrogate", "Kort 1", "Ny" + LONE_SURROGATE],
    ["bad-shop-name", "61 code points", "Kort 1", "x".repeat(61)],
    ["bad-shop-name", "(no name)", "Kort 1", "(no name)"],
    ["bad-shop-name", "(no name) in another case", "Kort 1", "(No Name)"],
    ["name-taken", "a liability's name", "Kort 1", "billaan"],
    ["name-taken", "an inactive expense account's name", "Kort 1", "Gammel butik"],
    ["name-taken", "an asset account's name", "Kort 1", "KONTO A"],
    ["name-taken", "a revenue account's name", "Kort 1", "Butik B"],
  ])("writes the category and refuses the shop as %s for %s", async (reason, _, description, shop) => {
    const s = setup({ data: shopSeed });
    const before = (await s.splits()).get(description)!;
    const accountsBefore = await s.accounts();
    const { postings, answer } = await writeShops(s, [{ description, shop }]);
    expect(answer.value.results).toEqual([{ posting_id: postings[0], ok: true, shop_refused: reason }]);
    const after = (await s.splits()).get(description)!;
    expect(after).toMatchObject({ category_name: "Dagligvarer", destination_id: before.destination_id,
      destination_name: before.destination_name, destination_type: before.destination_type });
    expect(s.posts()).toEqual([]);
    expect(await s.accounts()).toEqual(accountsBefore);
    const body = s.puts()[0].body as { transactions: Record<string, unknown>[] };
    expect(body.transactions[0]).not.toHaveProperty("destination_id");
    s.logsNoShop("Ny butik", "Billaan", "billaan", "Gammel butik", "KONTO A", "Butik B");
  });

  it("writes the category and refuses the shop as has-shop for a withdrawal paying a liability named (no name)",
    async () => {
      const data: SeedData = {
        ...shopSeed,
        otherAccounts: [...shopSeed.otherAccounts!, { name: "(no name)", type: "liabilities", active: true }],
        transactions: [...shopSeed.transactions, one({ type: "withdrawal", date: "2026-03-09", amount: "70.00",
          description: "Afdrag", source: "Konto A", destination: "(no name)" })],
      };
      const s = setup({ data });
      const before = (await s.splits()).get("Afdrag")!;
      expect(before).toMatchObject({ destination_name: "(no name)", destination_type: "Loan" });
      const { postings, answer } = await writeShops(s, [{ description: "Afdrag", shop: "Ny butik" }]);
      expect(answer.value.results).toEqual([{ posting_id: postings[0], ok: true, shop_refused: "has-shop" }]);
      expect((await s.splits()).get("Afdrag")).toMatchObject({ category_name: "Dagligvarer",
        destination_id: before.destination_id, destination_name: "(no name)", destination_type: "Loan" });
      expect(s.posts()).toEqual([]);
      const body = s.puts()[0].body as { transactions: Record<string, unknown>[] };
      expect(body.transactions[0]).not.toHaveProperty("destination_id");
      s.logsNoShop("Ny butik");
    });

  it("writes an existing shop for its exact name and for its name in another case, and echoes its spelling", async () => {
    const s = setup({ data: shopSeed });
    const shop = (await s.accounts()).find((a) => a.name === "Butik A")!;
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1", shop: "Butik A" },
      { description: "Kort 2", shop: " BUTIK a" },
    ]);
    expect(answer.value.results).toEqual([
      { posting_id: postings[0], ok: true, shop: "Butik A" },
      { posting_id: postings[1], ok: true, shop: "Butik A" },
    ]);
    const after = await s.splits();
    expect(after.get("Kort 1")).toMatchObject({ destination_id: shop.id, destination_name: "Butik A" });
    expect(after.get("Kort 2")).toMatchObject({ destination_id: shop.id, destination_name: "Butik A" });
    expect(s.posts()).toEqual([]);
    s.logsNoShop("Butik A", "BUTIK a");
  });

  it("takes the exact one of two shops that differ in case, else the first in code-point order", async () => {
    const s = setup({ data: shopSeed });
    const accounts = await s.accounts();
    const id = (name: string) => accounts.find((a) => a.name === name)!.id;
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1", shop: "bager" },
      { description: "Kort 2", shop: "Bager" },
      { description: "Kort 3", shop: "BAGER" },
    ]);
    expect(answer.value.results).toEqual([
      { posting_id: postings[0], ok: true, shop: "bager" },
      { posting_id: postings[1], ok: true, shop: "Bager" },
      { posting_id: postings[2], ok: true, shop: "Bager" },
    ]);
    const after = await s.splits();
    expect(after.get("Kort 1")!.destination_id).toBe(id("bager"));
    expect(after.get("Kort 2")!.destination_id).toBe(id("Bager"));
    expect(after.get("Kort 3")!.destination_id).toBe(id("Bager"));
    expect(s.posts()).toEqual([]);
    s.logsNoShop("bager", "Bager", "BAGER");
  });

  it.each([
    ["one new name in two cases", "Ny butik", "NY BUTIK", "Ny butik"],
    ["one new name in NFC and NFD", CAFE_NFD, CAFE_NFC, CAFE_NFC],
  ])("makes one account for %s in one call", async (_, first, second, written) => {
    const s = setup({ data: shopSeed });
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1", shop: first },
      { description: "Kort 2", shop: second },
    ]);
    expect(answer.value.results).toEqual([
      { posting_id: postings[0], ok: true, shop: written },
      { posting_id: postings[1], ok: true, shop: written },
    ]);
    expect(s.posts().map((p) => p.body)).toEqual([{ name: written, type: "expense" }]);
    const after = await s.splits();
    expect(after.get("Kort 1")!.destination_name).toBe(written);
    expect(after.get("Kort 2")!.destination_id).toBe(after.get("Kort 1")!.destination_id);
  });

  it("takes a name of 60 code points with an emoji", async () => {
    const s = setup({ data: shopSeed });
    const name = "x".repeat(59) + GRINNING_FACE;
    const { postings, answer } = await writeShops(s, [{ description: "Kort 1", shop: name }]);
    expect(answer.value.results).toEqual([{ posting_id: postings[0], ok: true, shop: name }]);
    expect((await s.splits()).get("Kort 1")!.destination_name).toBe(name);
  });

  it("changes only the assigned split's destination in a split group", async () => {
    const s = setup({ data: shopSeed });
    const before = await s.splits();
    const { postings, answer } = await writeShops(s, [{ description: "Kort del 1", shop: "Ny butik" }]);
    expect(answer.value.results).toEqual([{ posting_id: postings[0], ok: true, shop: "Ny butik" }]);
    const after = await s.splits();
    expect(after.get("Kort del 1")).toMatchObject({ category_name: "Dagligvarer", destination_name: "Ny butik" });
    expect(after.get("Kort del 2")).toEqual(before.get("Kort del 2"));
    const body = s.puts()[0].body as { group_title: string; transactions: Record<string, unknown>[] };
    expect(body.group_title).toBe("Kort i alt");
    expect(body.transactions[1]).toEqual({ transaction_journal_id: before.get("Kort del 2")!.transaction_journal_id });
  });

  it("writes an assignment without a shop as before, beside one with a shop", async () => {
    const s = setup({ data: shopSeed });
    const before = (await s.splits()).get("Kort 1")!;
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1" },
      { description: "Kort 2", shop: "Ny butik" },
    ]);
    expect(answer.value.results).toEqual([
      { posting_id: postings[0], ok: true },
      { posting_id: postings[1], ok: true, shop: "Ny butik" },
    ]);
    expect((await s.splits()).get("Kort 1")).toEqual({ ...before, category_id: expect.any(String),
      category_name: "Dagligvarer", tags: ["Mad"] });
    const body = s.puts()[0].body as { transactions: Record<string, unknown>[] };
    expect(body.transactions[0]).not.toHaveProperty("destination_id");
  });

  it("makes no account and writes no shop for an assignment refused for its category or its posting", async () => {
    const s = setup({ data: shopSeed });
    const before = await s.splits();
    const { postings, answer } = await writeShops(s, [
      { description: "Kort 1", shop: "Ny butik", category: "Gammel" },
      { description: "Husleje marts", shop: "Ny butik" },
    ]);
    expect(answer.value.results).toEqual([
      { posting_id: postings[0], ok: false, reason: "no-main-group" },
      { posting_id: postings[1], ok: false, reason: "not-in-inbox" },
    ]);
    const kort2 = await s.postingId("Kort 2");
    const wrongAmount = await s.call("set_category", { assignments: [
      { posting_id: kort2, category_id: (await s.categoryIds()).get("Dagligvarer")!, amount: "99.00", shop: "Ny butik" },
    ] });
    expect(wrongAmount.value.results).toEqual([{ posting_id: kort2, ok: false, reason: "amount-mismatch" }]);
    expect(s.posts()).toEqual([]);
    expect(s.puts()).toEqual([]);
    expect(await s.splits()).toEqual(before);
  });

  it.each([
    ["null", null],
    ["a number", 5],
    ["a list", ["Ny butik"]],
  ])("refuses a shop that is %s whole, and writes nothing", async (_, shop) => {
    const s = setup({ data: shopSeed });
    const kort = await s.postingId("Kort 1");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    s.fake.requests.length = 0;
    const { isError, value } = await s.call("set_category", {
      assignments: [{ posting_id: kort, category_id: food, amount: "10.00", shop }],
    });
    expect(isError).toBe(true);
    expect(value).toEqual({ error: "bad-arguments", reason: expect.any(String) });
    expect(s.fake.requests).toEqual([]);
  });
});
