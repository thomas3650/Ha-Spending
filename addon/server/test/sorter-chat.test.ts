import { createFakeFirefly, type SeedData, type SeedRule, type SeedSplit } from "@ha-spending/dev";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient, type FetchLike } from "../src/firefly/client";
import type { WireCategory, WireGroup, WirePage, WireSplit } from "../src/firefly/wire";
import { type ChatSettings, createChatTools } from "../src/sorter/chat";
import { createSorterApp } from "../src/sorter/http";
import { createSorterTools } from "../src/sorter/tools";

const KEY = "made-up-sorter-key-made-up-sorter-key";

const SETTINGS: ChatSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  inboxCategory: "Til sortering",
  pageSize: 3,
  timeoutMs: 1000,
  movedTag: "moved-by-assistant",
};

/** Noon on 2026-11-01 in the tests' zone (UTC), so the note's date is that day. */
const NOW = () => new Date(2026, 10, 1, 12);

function tagRule(category: string, tag: string): SeedRule {
  return {
    title: `${category} → ${tag}`,
    active: true,
    triggers: [{ type: "category_is", value: category }],
    actions: [{ type: "add_tag", value: tag }],
  };
}

const one = (split: SeedSplit) => ({ splits: [split] });

const LONG = `Langt køb ${"a".repeat(200)}`;

/** Made up. */
const seed: SeedData = {
  accounts: [
    { name: "Konto A", active: true },
    { name: "Konto B", active: true },
  ],
  categories: ["Dagligvarer", "Café", "Husleje", "Indskud", "Til sortering", "Gammel"],
  ruleGroups: [
    {
      title: "Hovedgrupper",
      rules: [
        tagRule("Dagligvarer", "Mad"),
        tagRule("Café", "Mad"),
        tagRule("Husleje", "Bolig"),
        tagRule("Indskud", "Penge ind og ud"),
        tagRule("Til sortering", "Til sortering"),
      ],
    },
  ],
  transactions: [
    one({ type: "withdrawal", date: "2026-10-03", amount: "412.50", description: "Indkøb i Butik A", source: "Konto A",
      destination: "Butik A", category: "Dagligvarer", tags: ["Mad", "Kvittering"], notes: "Banken: Dagligvarer" }),
    one({ type: "withdrawal", date: "2026-10-05", amount: "38.00", description: "Kaffe og kage", source: "Konto A",
      destination: "Café Hjørnet", category: "Dagligvarer", tags: ["Mad"] }),
    one({ type: "deposit", date: "2026-10-07", amount: "50.25", description: "Returvare Butik A", source: "Butik A",
      destination: "Konto B", category: "Dagligvarer", tags: ["Mad"] }),
    one({ type: "withdrawal", date: "2026-10-01", amount: "8000.00", description: "Husleje oktober", source: "Konto A",
      destination: "Udlejer", category: "Husleje", tags: ["Bolig"] }),
    one({ type: "transfer", date: "2026-10-10", amount: "300.00", description: "Overførsel", source: "Konto A",
      destination: "Konto B" }),
    {
      groupTitle: "Indkøb",
      splits: [
        { type: "withdrawal", date: "2026-10-12", amount: "100.00", description: "Del 1", source: "Konto A",
          destination: "Butik C", category: "Dagligvarer", tags: ["Mad"] },
        { type: "withdrawal", date: "2026-10-12", amount: "50.00", description: "Del 2", source: "Konto A",
          destination: "Butik C", category: "Café", tags: ["Mad"] },
      ],
    },
    one({ type: "deposit", date: "2026-10-15", amount: "5000.00", description: "Indskud fra familien",
      source: "Familien", destination: "Konto A", category: "Indskud", tags: ["Penge ind og ud"] }),
    one({ type: "withdrawal", date: "2026-10-20", amount: "45.00", description: "Kiosk", source: "Konto A" }),
    one({ type: "withdrawal", date: "2026-10-22", amount: "75.00", description: "Ukendt", source: "Konto A",
      destination: "Butik B", category: "Gammel" }),
    one({ type: "withdrawal", date: "2025-09-01", amount: "99.00", description: "Gammelt køb", source: "Konto A",
      destination: "Butik A", category: "Dagligvarer", tags: ["Mad"] }),
    one({ type: "withdrawal", date: "2026-09-15", amount: "10.00", description: LONG, source: "Konto A",
      destination: "Butik A", category: "Dagligvarer", tags: ["Mad"] }),
  ],
};

const TEXTS = ["Kiosk", "Butik", "Kaffe", "Husleje oktober", "Del 1", "Banken", "Det var", "412", "38.00", KEY];

const OCTOBER = { start: "2026-10-01", end: "2026-10-31" };

interface Result {
  isError: boolean;
  value: Record<string, unknown>;
}

interface SetupOptions {
  data?: SeedData;
  settings?: Partial<ChatSettings>;
  fetch?: (f: FetchLike) => FetchLike;
}

function setup(options: SetupOptions = {}) {
  const fake = createFakeFirefly(options.data ?? seed);
  const fetch = options.fetch ? options.fetch(fake.fetch) : fake.fetch;
  const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch });
  const direct = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
  const log = vi.fn();
  const settings = { ...SETTINGS, ...options.settings };
  const tools = [...createSorterTools(client, settings, log), ...createChatTools(client, settings, log, NOW)];
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

  async function categoryId(name: string): Promise<number> {
    const page = (await direct.get("categories", { limit: "500" })) as WirePage<WireCategory>;
    return Number(page.data.find((c) => c.attributes.name === name)!.id);
  }

  async function splits(): Promise<Map<string, WireSplit>> {
    const query = { start: "1900-01-01", end: "2100-01-01", type: "all", limit: "500" };
    const page = (await direct.get("transactions", query)) as WirePage<WireGroup>;
    return new Map(page.data.flatMap((g) => g.attributes.transactions.map((s) => [s.description, s])));
  }

  const postingId = async (description: string) => Number((await splits()).get(description)!.transaction_journal_id);

  const puts = () => fake.requests.filter((r) => r.method === "PUT");
  const writes = () => fake.requests.filter((r) => r.method !== "GET");

  function logsNoPosting() {
    for (const line of log.mock.calls.flat().map(String)) for (const text of TEXTS) expect(line).not.toContain(text);
  }

  return { fake, app, log, call, categoryId, splits, postingId, puts, writes, logsNoPosting };
}

type Found = { description: string } & Record<string, unknown>;

describe("find_postings", () => {
  it("finds the withdrawals and deposits of a period, newest first, without transfers", async () => {
    const s = setup();
    const { isError, value } = await s.call("find_postings", OCTOBER);
    expect(isError).toBe(false);
    const postings = value.postings as Found[];
    expect(postings.map((p) => p.description)).toEqual([
      "Ukendt",
      "Kiosk",
      "Indskud fra familien",
      "Del 2",
      "Del 1",
      "Returvare Butik A",
      "Kaffe og kage",
      "Indkøb i Butik A",
      "Husleje oktober",
    ]);
    expect(value.more).toBe(false);
    expect(postings[6]).toEqual({
      posting_id: await s.postingId("Kaffe og kage"),
      date: "2026-10-05",
      type: "withdrawal",
      amount: "38.00",
      description: "Kaffe og kage",
      category: "Dagligvarer",
      main_group: "Mad",
      shop: "Café Hjørnet",
    });
    expect(postings[5]).toMatchObject({ type: "deposit", amount: "50.25", shop: "Butik A" });
    expect(postings[1]).toMatchObject({ category: null, main_group: null, shop: null });
    expect(postings[0]).toMatchObject({ category: "Gammel", main_group: null });
    expect(postings[2]).toMatchObject({ category: "Indskud", main_group: "Penge ind og ud" });
    expect(s.writes()).toEqual([]);
    s.logsNoPosting();
  });

  it("finds by text in the description or the shop, in any case", async () => {
    const s = setup();
    const byText = async (text: string) =>
      ((await s.call("find_postings", { ...OCTOBER, text })).value.postings as Found[]).map((p) => p.description);
    expect(await byText("butik a")).toEqual(["Returvare Butik A", "Indkøb i Butik A"]);
    expect(await byText("HJØRNET")).toEqual(["Kaffe og kage"]);
    expect(await byText("nothing like it")).toEqual([]);
  });

  it("finds by category, in any case", async () => {
    const s = setup();
    const { value } = await s.call("find_postings", { ...OCTOBER, category: "café" });
    expect((value.postings as Found[]).map((p) => p.description)).toEqual(["Del 2"]);
  });

  it("answers the newest postings up to the limit, and says when there are more", async () => {
    const s = setup();
    const { value } = await s.call("find_postings", { ...OCTOBER, limit: 2 });
    expect((value.postings as Found[]).map((p) => p.description)).toEqual(["Ukendt", "Kiosk"]);
    expect(value.more).toBe(true);
  });

  it("answers 25 by default and at most 50", async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
    const transactions = Array.from({ length: 51 }, (_, n) =>
      one({ type: "withdrawal" as const, date: day(n), amount: "1.00", description: `Køb ${n}`, source: "Konto A",
        destination: "Butik" }));
    const s = setup({ data: { ...seed, transactions } });
    const year = { start: "2026-01-01", end: "2026-12-31" };
    const first = await s.call("find_postings", year);
    expect((first.value.postings as Found[]).length).toBe(25);
    expect(first.value.more).toBe(true);
    const all = await s.call("find_postings", { ...year, limit: 50 });
    expect((all.value.postings as Found[]).map((p) => p.description)[0]).toBe("Køb 50");
    expect((all.value.postings as Found[]).length).toBe(50);
    expect(all.value.more).toBe(true);
  });

  it("cuts a long description as start does", async () => {
    const s = setup();
    const { value } = await s.call("find_postings", { start: "2026-09-01", end: "2026-09-30" });
    const [found] = value.postings as Found[];
    expect(Array.from(found.description)).toHaveLength(150);
    expect(found.description.endsWith("…")).toBe(true);
  });

  it("takes a period of up to 400 days, both days counted", async () => {
    const s = setup();
    expect((await s.call("find_postings", { start: "2025-10-01", end: "2026-11-04" })).isError).toBe(false);
    expect((await s.call("find_postings", { start: "2025-10-01", end: "2026-11-05" })).value).toMatchObject({
      error: "bad-arguments",
    });
  });

  it.each([
    ["no period", {}],
    ["an end before the start", { start: "2026-10-02", end: "2026-10-01" }],
    ["a day that does not exist", { start: "2026-02-30", end: "2026-03-01" }],
    ["a date in another form", { start: "1.10.2026", end: "2026-10-31" }],
    ["a limit of 0", { ...OCTOBER, limit: 0 }],
    ["a limit of 51", { ...OCTOBER, limit: 51 }],
    ["a limit that is not whole", { ...OCTOBER, limit: 2.5 }],
    ["a text of 61 characters", { ...OCTOBER, text: "a".repeat(61) }],
    ["a category that is not text", { ...OCTOBER, category: 3 }],
    ["an argument it does not know", { ...OCTOBER, account: "Konto A" }],
  ])("refuses %s as bad-arguments, and reads nothing", async (_, args) => {
    const s = setup();
    const { isError, value } = await s.call("find_postings", args);
    expect(isError).toBe(true);
    expect(value.error).toBe("bad-arguments");
    expect(s.fake.requests).toEqual([]);
  });
});

describe("get_posting", () => {
  it("answers one posting with its notes and tags", async () => {
    const s = setup();
    const id = await s.postingId("Indkøb i Butik A");
    const { isError, value } = await s.call("get_posting", { posting_id: id });
    expect(isError).toBe(false);
    expect(value).toEqual({
      posting_id: id,
      date: "2026-10-03",
      type: "withdrawal",
      amount: "412.50",
      description: "Indkøb i Butik A",
      category: "Dagligvarer",
      main_group: "Mad",
      shop: "Butik A",
      notes: "Banken: Dagligvarer",
      tags: ["Mad", "Kvittering"],
    });
    expect(s.writes()).toEqual([]);
    s.logsNoPosting();
  });

  it("answers a transfer as one, with no shop", async () => {
    const s = setup();
    const { value } = await s.call("get_posting", { posting_id: await s.postingId("Overførsel") });
    expect(value).toMatchObject({ type: "transfer", amount: "300.00", category: null, shop: null, notes: null });
  });

  it("answers notes of 1,000 characters whole, and cuts longer notes to 1,000", async () => {
    const notes = (n: number) => "😀".repeat(n);
    const withNotes = (n: number) =>
      one({ type: "withdrawal" as const, date: "2026-10-02", amount: "1.00", description: `Noter ${n}`,
        source: "Konto A", destination: "Butik", notes: notes(n) });
    const s = setup({ data: { ...seed, transactions: [withNotes(1000), withNotes(1001)] } });
    const read = async (n: number) =>
      (await s.call("get_posting", { posting_id: await s.postingId(`Noter ${n}`) })).value.notes as string;
    expect(await read(1000)).toBe(notes(1000));
    const cut = await read(1001);
    expect(Array.from(cut)).toHaveLength(1000);
    expect(cut).toBe(`${notes(999)}…`);
  });

  it("answers not-found for a posting that is not there", async () => {
    const s = setup();
    expect((await s.call("get_posting", { posting_id: 99999 })).value).toEqual({ error: "not-found" });
  });

  it.each([[{}], [{ posting_id: 0 }], [{ posting_id: "5" }], [{ posting_id: 5, notes: "x" }]])(
    "refuses %j as bad-arguments",
    async (args) => {
      const s = setup();
      expect((await s.call("get_posting", args)).value).toMatchObject({ error: "bad-arguments" });
      expect(s.fake.requests).toEqual([]);
    },
  );
});

describe("spending", () => {
  it("sums a period by main group as the page does: no transfers, no excluded group, refunds subtracted", async () => {
    const s = setup();
    const { isError, value } = await s.call("spending", { ...OCTOBER, by: "main_group" });
    expect(isError).toBe(false);
    expect(value).toEqual({
      rows: [
        { name: "Bolig", amount: "8000.00" },
        { name: "Mad", amount: "550.25" },
        { name: null, amount: "120.00" },
      ],
      more: false,
      total: "8670.25",
    });
    expect(s.writes()).toEqual([]);
  });

  it("sums a period by category", async () => {
    const s = setup();
    const { value } = await s.call("spending", { ...OCTOBER, by: "category" });
    expect(value).toEqual({
      rows: [
        { name: "Husleje", amount: "8000.00" },
        { name: "Dagligvarer", amount: "500.25" },
        { name: "Gammel", amount: "75.00" },
        { name: "Café", amount: "50.00" },
        { name: null, amount: "45.00" },
      ],
      more: false,
      total: "8670.25",
    });
  });

  it("answers a refund on its own as a negative amount", async () => {
    const s = setup();
    const { value } = await s.call("spending", { start: "2026-10-07", end: "2026-10-07", by: "category" });
    expect(value).toEqual({ rows: [{ name: "Dagligvarer", amount: "-50.25" }], more: false, total: "-50.25" });
  });

  it("answers at most 50 rows, the largest, and the total of all", async () => {
    const names = Array.from({ length: 51 }, (_, n) => `Kategori ${n}`);
    const transactions = names.map((name, n) =>
      one({ type: "withdrawal" as const, date: "2026-10-10", amount: `${n + 1}.00`, description: name,
        source: "Konto A", destination: "Butik", category: name }));
    const s = setup({ data: { ...seed, categories: names, ruleGroups: [], transactions } });
    const { value } = await s.call("spending", { ...OCTOBER, by: "category" });
    const rows = value.rows as { name: string; amount: string }[];
    expect(rows).toHaveLength(50);
    expect(rows[0]).toEqual({ name: "Kategori 50", amount: "51.00" });
    expect(rows.at(-1)).toEqual({ name: "Kategori 1", amount: "2.00" });
    expect(value.more).toBe(true);
    expect(value.total).toBe("1326.00");
  });

  it.each([
    ["no grouping", OCTOBER],
    ["a grouping it does not know", { ...OCTOBER, by: "shop" }],
    ["a period of 401 days", { start: "2025-10-01", end: "2026-11-05", by: "category" }],
    ["an argument it does not know", { ...OCTOBER, by: "category", text: "x" }],
  ])("refuses %s as bad-arguments, and reads nothing", async (_, args) => {
    const s = setup();
    expect((await s.call("spending", args)).value).toMatchObject({ error: "bad-arguments" });
    expect(s.fake.requests).toEqual([]);
  });
});

describe("move_posting", () => {
  it("writes the category, the main group's tag, the moved tag and one line of notes, and nothing else", async () => {
    const s = setup();
    const before = (await s.splits()).get("Kaffe og kage")!;
    const cafe = await s.categoryId("Café");
    const { isError, value } = await s.call("move_posting", {
      posting_id: Number(before.transaction_journal_id),
      amount: "38.00",
      category_id: cafe,
      reason: "  Det var en café.  ",
    });
    expect(isError).toBe(false);
    expect(value).toEqual({ ok: true, from: "Dagligvarer", to: "Café" });

    const after = (await s.splits()).get("Kaffe og kage")!;
    const notes = "2026-11-01: Dagligvarer → Café. Det var en café.";
    expect(after).toEqual({ ...before, category_id: String(cafe), category_name: "Café",
      tags: ["Mad", "moved-by-assistant"], notes });
    expect(s.puts().map((p) => p.body)).toEqual([{ apply_rules: false, transactions: [{
      transaction_journal_id: before.transaction_journal_id, category_id: String(cafe),
      tags: ["Mad", "moved-by-assistant"], notes }] }]);
    expect(s.fake.requests.filter((r) => r.method === "POST")).toEqual([]);
    s.logsNoPosting();
  });

  it("appends to the notes, swaps the main group's tag and keeps every other tag", async () => {
    const s = setup();
    const before = (await s.splits()).get("Indkøb i Butik A")!;
    const { value } = await s.call("move_posting", {
      posting_id: Number(before.transaction_journal_id),
      amount: "412.50",
      category_id: await s.categoryId("Husleje"),
      reason: "Det var en del af huslejen",
    });
    expect(value).toEqual({ ok: true, from: "Dagligvarer", to: "Husleje" });
    const after = (await s.splits()).get("Indkøb i Butik A")!;
    expect(after.tags).toEqual(["Kvittering", "Bolig", "moved-by-assistant"]);
    expect(after.notes).toBe("Banken: Dagligvarer\n2026-11-01: Dagligvarer → Husleje. Det var en del af huslejen");
    const unchanged = (x: WireSplit) => [x.amount, x.date, x.description, x.type, x.source_id, x.destination_id];
    expect(unchanged(after)).toEqual(unchanged(before));
  });

  it("moves a posting with no category, and the moved tag once on a second move", async () => {
    const s = setup({ settings: { movedTag: "flyttet" } });
    const id = await s.postingId("Kiosk");
    const move = async (category: string, reason: string) =>
      s.call("move_posting", { posting_id: id, amount: "45.00", category_id: await s.categoryId(category), reason });
    expect((await move("Dagligvarer", "Slik")).value).toEqual({ ok: true, from: "(no category)", to: "Dagligvarer" });
    expect((await move("Café", "Kaffe")).value).toEqual({ ok: true, from: "Dagligvarer", to: "Café" });
    const after = (await s.splits()).get("Kiosk")!;
    expect(after.tags).toEqual(["Mad", "flyttet"]);
    expect(after.notes)
      .toBe("2026-11-01: (no category) → Dagligvarer. Slik\n2026-11-01: Dagligvarer → Café. Kaffe");
  });

  it("adds the line after notes that end in a line break, with no blank line", async () => {
    const data: SeedData = {
      ...seed,
      transactions: [one({ type: "withdrawal", date: "2026-10-05", amount: "38.00", description: "Kaffe og kage",
        source: "Konto A", destination: "Café Hjørnet", category: "Dagligvarer", notes: "Banken: kaffe\n" })],
    };
    const s = setup({ data });
    const { value } = await s.call("move_posting", {
      posting_id: await s.postingId("Kaffe og kage"),
      amount: "38.00",
      category_id: await s.categoryId("Café"),
      reason: "Det var en café",
    });
    expect(value).toMatchObject({ ok: true });
    expect((await s.splits()).get("Kaffe og kage")!.notes)
      .toBe("Banken: kaffe\n2026-11-01: Dagligvarer → Café. Det var en café");
  });

  it("moves a deposit", async () => {
    const s = setup();
    const { value } = await s.call("move_posting", {
      posting_id: await s.postingId("Returvare Butik A"),
      amount: "50.25",
      category_id: await s.categoryId("Café"),
      reason: "Retur af en kop",
    });
    expect(value).toEqual({ ok: true, from: "Dagligvarer", to: "Café" });
  });

  describe("refuses, and writes nothing", () => {
    const refused = async (
      s: ReturnType<typeof setup>,
      args: { description: string; amount: string; category: string } | Record<string, unknown>,
    ) => {
      const given =
        typeof args.description === "string" && typeof args.category === "string"
          ? {
              posting_id: await s.postingId(args.description),
              amount: args.amount,
              category_id: await s.categoryId(args.category),
              reason: "En grund",
            }
          : args;
      const before = await s.splits();
      const { isError, value } = await s.call("move_posting", given);
      expect(isError).toBe(true);
      expect(s.writes()).toEqual([]);
      expect(await s.splits()).toEqual(before);
      return value;
    };

    it("a transfer", async () => {
      const s = setup();
      expect(await refused(s, { description: "Overførsel", amount: "300.00", category: "Dagligvarer" }))
        .toEqual({ error: "transfer" });
    });

    it("a posting split in parts, either part", async () => {
      const s = setup();
      expect(await refused(s, { description: "Del 1", amount: "100.00", category: "Café" }))
        .toEqual({ error: "split" });
      expect(await refused(s, { description: "Del 2", amount: "50.00", category: "Dagligvarer" }))
        .toEqual({ error: "split" });
    });

    it("a category in an excluded main group", async () => {
      const s = setup();
      expect(await refused(s, { description: "Kaffe og kage", amount: "38.00", category: "Indskud" }))
        .toEqual({ error: "excluded" });
    });

    it("a posting in an excluded main group", async () => {
      const s = setup();
      expect(await refused(s, { description: "Indskud fra familien", amount: "5000.00", category: "Dagligvarer" }))
        .toEqual({ error: "excluded" });
    });

    it("a category outside the tree: unknown, the inbox, or in no main group", async () => {
      const s = setup();
      const id = await s.postingId("Kaffe og kage");
      const move = { posting_id: id, amount: "38.00", reason: "En grund" };
      expect(await refused(s, { ...move, category_id: 99999 }))
        .toEqual({ error: "unknown-category", reason: "unknown-category" });
      expect(await refused(s, { ...move, category_id: await s.categoryId("Til sortering") }))
        .toEqual({ error: "unknown-category", reason: "inbox-category" });
      expect(await refused(s, { ...move, category_id: await s.categoryId("Gammel") }))
        .toEqual({ error: "unknown-category", reason: "no-main-group" });
    });

    it("a category the rules put in two main groups", async () => {
      const data: SeedData = {
        ...seed,
        ruleGroups: [{ title: "Hovedgrupper", rules: [...seed.ruleGroups[0].rules, tagRule("Café", "Fritid")] }],
      };
      const s = setup({ data });
      expect(await refused(s, { description: "Kaffe og kage", amount: "38.00", category: "Café" }))
        .toEqual({ error: "unknown-category", reason: "ambiguous-main-group" });
    });

    it("a posting that is not there", async () => {
      const s = setup();
      const category_id = await s.categoryId("Café");
      expect(await refused(s, { posting_id: 99999, amount: "38.00", category_id, reason: "En grund" }))
        .toEqual({ error: "not-found" });
    });

    it("an amount that does not match", async () => {
      const s = setup();
      expect(await refused(s, { description: "Kaffe og kage", amount: "38.01", category: "Café" }))
        .toEqual({ error: "amount-mismatch" });
    });

    it("the category the posting already has", async () => {
      const s = setup();
      expect(await refused(s, { description: "Kaffe og kage", amount: "38.00", category: "Dagligvarer" }))
        .toEqual({ error: "same-category" });
    });

    it("a posting that is neither a withdrawal, a deposit nor a transfer", async () => {
      const s = setup({
        fetch: (fetch) => async (input, init) => {
          const res = await fetch(input, init);
          if (!/\/transactions\/[0-9]+$/.test(new URL(String(input)).pathname)) return res;
          const body = (await res.json()) as { data: WireGroup };
          for (const split of body.data.attributes.transactions) split.type = "opening balance";
          return Response.json(body);
        },
      });
      expect(await refused(s, { description: "Kaffe og kage", amount: "38.00", category: "Café" }))
        .toEqual({ error: "not-withdrawal-or-deposit" });
    });

    it.each([
      ["no reason", { reason: undefined }],
      ["a reason of only spaces", { reason: "   " }],
      ["a reason of 301 characters", { reason: "😀".repeat(301) }],
      ["a reason on two lines", { reason: "En\nto" }],
      ["a reason with a zero-width space", { reason: "En​grund" }],
      ["an amount not like 38.00", { amount: "38" }],
      ["a posting id of 0", { posting_id: 0 }],
      ["a category id as text", { category_id: "7" }],
      ["a description to write", { description: "Ny tekst" }],
      ["a date to write", { date: "2026-10-06" }],
    ])("bad arguments: %s", async (_, change) => {
      const s = setup();
      const args = {
        posting_id: await s.postingId("Kaffe og kage"),
        amount: "38.00",
        category_id: await s.categoryId("Café"),
        reason: "En grund",
        ...change,
      };
      expect(await refused(s, args)).toMatchObject({ error: "bad-arguments" });
    });

    it("when Firefly III does not answer", async () => {
      const s = setup();
      const id = await s.postingId("Kaffe og kage");
      const category_id = await s.categoryId("Café");
      s.fake.fault = "error";
      const { value } = await s.call("move_posting", { posting_id: id, amount: "38.00", category_id, reason: "x" });
      expect(value).toEqual({ error: "unreachable" });
      s.fake.fault = null;
      expect((await s.splits()).get("Kaffe og kage")!.category_name).toBe("Dagligvarer");
    });
  });

  it("takes a reason of 300 characters", async () => {
    const s = setup();
    const { value } = await s.call("move_posting", {
      posting_id: await s.postingId("Kaffe og kage"),
      amount: "38.00",
      category_id: await s.categoryId("Café"),
      reason: "😀".repeat(300),
    });
    expect(value).toMatchObject({ ok: true });
  });
});

describe("the chat's tools on the sorter's endpoint", () => {
  it("lists them after the sorter's two, each with a description and an object schema", async () => {
    const { app } = setup();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const { result } = (await res.json()) as {
      result: { tools: { name: string; description: string; inputSchema: { type: string; required: string[] } }[] };
    };
    expect(result.tools.map((t) => t.name)).toEqual([
      "start",
      "set_category",
      "find_postings",
      "get_posting",
      "spending",
      "move_posting",
    ]);
    for (const tool of result.tools) {
      expect(tool.description).not.toBe("");
      expect(tool.inputSchema.type).toBe("object");
    }
    expect(result.tools.slice(2).map((t) => t.inputSchema.required)).toEqual([
      ["start", "end"],
      ["posting_id"],
      ["start", "end", "by"],
      ["posting_id", "amount", "category_id", "reason"],
    ]);
  });

  it("still needs the key: a move without it answers 401 and writes nothing", async () => {
    const s = setup();
    const res = await s.app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "move_posting",
        arguments: { posting_id: 2, amount: "38.00", category_id: 3, reason: "x" } } }),
    });
    expect(res.status).toBe(401);
    expect(s.fake.requests).toEqual([]);
  });
});
