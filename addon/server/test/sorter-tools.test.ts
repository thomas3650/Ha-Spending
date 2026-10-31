import { createFakeFirefly, type SeedData, type SeedRule, type SeedSplit } from "@ha-spending/dev";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient, type FetchLike } from "../src/firefly/client";
import type { WireCategory, WireGroup, WirePage, WireSplit } from "../src/firefly/wire";
import { createSorterApp } from "../src/sorter/http";
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

  function logsNoPosting() {
    for (const line of log.mock.calls.flat().map(String)) for (const text of TEXTS) expect(line).not.toContain(text);
  }

  return { fake, direct, log, call, categoryIds, splits, postingId, tree, puts, logsNoPosting };
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

  it("answers at most 500 postings, the oldest", async () => {
    const day = (n: number) => new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10);
    const transactions = Array.from({ length: 501 }, (_, n) =>
      one({ type: "withdrawal" as const, date: day(n), amount: "1.00", description: `Køb ${n}`,
        source: "Konto A", destination: "Butik" }),
    );
    const s = setup({ data: { ...seed, transactions }, settings: { pageSize: 200 } });
    const { value } = await s.call("start", { categories: await s.tree() });
    const postings = value.postings as { date: string }[];
    expect(postings).toHaveLength(500);
    expect(postings[0].date).toBe(day(0));
    expect(postings[499].date).toBe(day(499));
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

    const answer = await s.call("set_category", { assignments: [{ posting_id: posting, category_id: food }] });
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

  it("takes a posting out of the inbox category and replaces its main group tag", async () => {
    const s = setup();
    const posting = await s.postingId("Returvare Butik B");
    const rent = (await s.categoryIds()).get("Husleje")!;
    const { value } = await s.call("set_category", { assignments: [{ posting_id: posting, category_id: rent }] });
    expect(value.results).toEqual([{ posting_id: posting, ok: true }]);
    expect((await s.splits()).get("Returvare Butik B")).toMatchObject({ category_name: "Husleje", tags: ["Bolig"] });
  });

  it("keeps the other splits of a split group", async () => {
    const s = setup();
    const before = await s.splits();
    const first = Number(before.get("Del 1")!.transaction_journal_id);
    const other = (await s.categoryIds()).get("Mad: Øvrige")!;
    const { value } = await s.call("set_category", { assignments: [{ posting_id: first, category_id: other }] });
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
    const { isError, value } = await s.call("set_category", {
      assignments: [
        { posting_id: rent, category_id: ids.get("Dagligvarer")! },
        { posting_id: kiosk, category_id: ids.get("Dagligvarer")! },
      ],
    });
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
    const { value } = await s.call("set_category", { assignments: [{ posting_id: posting, category_id: categoryId }] });
    expect(value.results).toEqual([{ posting_id: posting, ok: false, reason }]);
    expect(s.puts()).toEqual([]);
    expect(await s.splits()).toEqual(before);
  });

  it("refuses a posting or a category Firefly III does not have", async () => {
    const s = setup();
    const kiosk = await s.postingId("Kiosk");
    const food = (await s.categoryIds()).get("Dagligvarer")!;
    const { value } = await s.call("set_category", {
      assignments: [
        { posting_id: 99999, category_id: food },
        { posting_id: kiosk, category_id: 99999 },
      ],
    });
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
    const { value } = await s.call("set_category", { assignments: [{ posting_id: kiosk, category_id: food }] });
    expect(value.results).toEqual([{ posting_id: kiosk, ok: false, reason: "ambiguous-main-group" }]);
    expect(s.puts()).toEqual([]);
  });

  it("never overwrites a hand correction made since start", async () => {
    const s = setup();
    const ids = await s.categoryIds();
    const { value } = await s.call("start", { categories: await s.tree() });
    const shop = (value.postings as { posting_id: number; description: string }[])
      .find((p) => p.description === "Indkøb i Butik A")!;
    const split = (await s.splits()).get("Indkøb i Butik A")!;
    await s.direct.put(`transactions/${split.groupId}`, {
      transactions: [{ transaction_journal_id: split.transaction_journal_id, category_id: String(ids.get("Husleje")) }],
    });

    const answer = await s.call("set_category", {
      assignments: [{ posting_id: shop.posting_id, category_id: ids.get("Dagligvarer")! }],
    });
    expect(answer.value.results).toEqual([{ posting_id: shop.posting_id, ok: false, reason: "not-in-inbox" }]);
    expect((await s.splits()).get("Indkøb i Butik A")!.category_name).toBe("Husleje");
    expect(s.puts()).toHaveLength(1);
  });

  it.each([
    ["an empty list", () => []],
    ["more than 100 assignments", (p: number, c: number) => Array.from({ length: 101 }, (_, n) =>
      ({ posting_id: n === 0 ? p : 100000 + n, category_id: c }))],
    ["a posting given twice", (p: number, c: number) => [{ posting_id: p, category_id: c }, { posting_id: p, category_id: c }]],
    ["an id that is not a whole number", (p: number) => [{ posting_id: p, category_id: "1" }]],
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
    s.fake.fault = "error";
    const answer = await s.call("set_category", { assignments: [{ posting_id: kiosk, category_id: food }] });
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
    const answer = await s.call("set_category", {
      assignments: ids.map((posting_id) => ({ posting_id, category_id: food })),
    });
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
