import { createFakeFirefly, exampleSeed, seedFirefly } from "@ha-spending/dev";
import { classify, parts, type SpendingData } from "@ha-spending/shared";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createChatTools } from "../src/sorter/chat";
import { createSorterApp } from "../src/sorter/http";
import { createSorterTools, readAccounts } from "../src/sorter/tools";
import { createApp } from "../src/app";
import { createFireflyClient, type FetchLike, type FireflyClient, FireflyError } from "../src/firefly/client";
import { type ReadSettings, readSpendingData, readVersion } from "../src/firefly/read";
import type { WireAccount, WireBill, WireCategory, WireGroup, WirePage, WireSplit } from "../src/firefly/wire";

const settings: ReadSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 5,
  timeoutMs: 30_000,
};
const R1 = { start: "2025-12-01", end: "2026-07-31" };
const today = "2026-10-30";

const sum = (amounts: { amount: number }[]) => amounts.reduce((s, p) => s + p.amount, 0);

let url: string;
let token: string;
let client: FireflyClient;

const read = (range: { start: string; end: string }, c = client) =>
  readSpendingData(c, settings, range, { today, warn: () => {} });

beforeAll(async () => {
  const givenUrl = process.env.FIREFLY_URL;
  const givenToken = process.env.FIREFLY_TOKEN;
  if (!givenUrl || !givenToken) throw new Error("FIREFLY_URL and FIREFLY_TOKEN must be set: run scripts/integration");
  url = givenUrl;
  token = givenToken;
  await seedFirefly(url, token, exampleSeed);
  client = createFireflyClient({ baseUrl: url, token });
});

describe("a real Firefly III", () => {
  it("tells the pinned version", async () => {
    expect(await readVersion(client)).toBe("6.7.9");
  });

  it("reads the example dataset as the fake does", async () => {
    const warn = vi.fn();
    const d = await readSpendingData(client, settings, R1, { today, warn });
    expect(d.postings).toHaveLength(13);
    expect(sum(d.postings)).toBe(1059958);
    expect(d.earliestPostingDate).toBe("2025-12-03");
    expect(d.accounts.map((a) => a.name)).toEqual(["Konto A", "Konto B", "Konto C"]);
    expect(d.categories).toEqual([
      { name: "Brændstof", mainGroup: "Bil" },
      { name: "Café", mainGroup: "Mad" },
      { name: "Dagligvarer", mainGroup: "Mad" },
      { name: "Gaver", mainGroup: null },
      { name: "Husleje", mainGroup: "Bolig" },
      { name: "Streaming", mainGroup: "Abonnementer" },
      { name: "Tandlæge", mainGroup: "Sundhed" },
    ]);
    expect(d.mainGroups).toEqual(["Abonnementer", "Bil", "Bolig", "Mad", "Sundhed"]);
    expect(d.mainGroupsFound).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map((c) => c[0]).join("\n")).toContain("Streaming");
  });

  it("filters the transactions by type as the fake does", async () => {
    const count = async (type: string) =>
      ((await client.get("transactions", { start: "1900-01-01", end: today, type, limit: "50" })) as WirePage<unknown>)
        .data.length;
    expect(await count("withdrawal")).toBe(13);
    expect(await count("deposit")).toBe(4);
    expect(await count("transfer")).toBe(2);
  });

  it("lists the inactive account as inactive", async () => {
    const answer = (await client.get("accounts", { type: "asset" })) as WirePage<WireAccount>;
    const listed = answer.data.map((a) => ({ name: a.attributes.name, active: a.attributes.active }));
    expect(listed).toEqual(
      expect.arrayContaining([
        { name: "Konto A", active: true },
        { name: "Konto B", active: true },
        { name: "Konto C", active: false },
      ]),
    );
  });

  it("agrees with the hand sums per main group and account", async () => {
    const d = await read(R1);
    const classified = classify(d.postings, d.categories);
    expect(parts(classified, { kind: "all" })).toEqual([
      { key: "Abonnementer", amount: 12900 },
      { key: "Bil", amount: 55000 },
      { key: "Bolig", amount: 800000 },
      { key: "Mad", amount: 172558 },
      { key: null, amount: 19500 },
    ]);
    expect(parts(classified, { kind: "mainGroup", mainGroup: "Mad" })).toEqual([
      { key: "Café", amount: 83000 },
      { key: "Dagligvarer", amount: 89558 },
    ]);
    expect(parts(classified, { kind: "mainGroup", mainGroup: null })).toEqual([
      { key: "Gaver", amount: 15000 },
      { key: null, amount: 4500 },
    ]);
    const byAccount = new Map(d.accounts.map((a) => [a.id, a.name]));
    const sums: Record<string, number> = {};
    for (const p of d.postings) {
      const name = byAccount.get(p.account)!;
      sums[name] = (sums[name] ?? 0) + p.amount;
    }
    expect(sums).toEqual({ "Konto A": 897125, "Konto B": 129500, "Konto C": 33333 });
  });

  it("reads more than one page", async () => {
    let pages = 0;
    const counting: FetchLike = (input, init) => {
      const asked = new URL(input instanceof Request ? input.url : input);
      const q = asked.searchParams;
      if (asked.pathname.endsWith("/transactions") && q.get("start") === R1.start && q.get("end") === R1.end) pages++;
      return fetch(input, init);
    };
    const d = await read(R1, createFireflyClient({ baseUrl: url, token, fetch: counting }));
    expect(d.postings).toHaveLength(13);
    expect(pages).toBe(4);
  });

  it("gives a posting's shop from its expense account, and a refund's from its revenue account", async () => {
    const d = await read(R1);
    expect(d.postings.find((p) => p.text === "Indkøb i Netto")?.shop).toBe("Netto");
    expect(d.postings.find((p) => p.text === "Returvare Netto")).toMatchObject({ kind: "refund", shop: "Netto" });
  });

  it("keeps the split group, the foreign posting and the summer refund", async () => {
    const d = await read(R1);
    const bilka = d.postings.filter((p) => p.text.startsWith("Bilka"));
    expect(bilka).toHaveLength(2);
    expect(bilka[0].groupId).toBe(bilka[1].groupId);
    expect(bilka[0].id).not.toBe(bilka[1].id);
    expect(d.postings.find((p) => p.text === "Hotel i Berlin")?.amount).toBe(74500);

    const july = await read({ start: "2026-07-01", end: "2026-07-31" });
    expect(july.postings).toHaveLength(1);
    expect(july.postings[0]).toMatchObject({ date: "2026-07-01", kind: "refund", amount: -60000 });
  });

  it("serves /api/data for a few periods", async () => {
    const app = createApp({ webDir: "/nowhere", dev: true, loadData: (r) => read(r), log: () => {} });
    const served = async (start: string, end: string) => {
      const res = await app.request(`/api/data?start=${start}&end=${end}`);
      expect(res.status).toBe(200);
      return (await res.json()) as SpendingData;
    };
    expect(sum((await served("2025-12-01", "2026-07-31")).postings)).toBe(1059958);
    const january = await served("2026-01-01", "2026-01-31");
    expect(january.postings).toHaveLength(5);
    expect(sum(january.postings)).toBe(126900);
    const february = await served("2026-02-01", "2026-02-28");
    expect(february.postings).toHaveLength(2);
    expect(sum(february.postings)).toBe(88333);
  });

  describe("subscriptions", () => {
    const served = async () => {
      const app = createApp({ webDir: "/nowhere", dev: true, loadData: (r) => read(r), log: () => {} });
      const res = await app.request("/api/data?start=2025-12-01&end=2026-07-31");
      expect(res.status).toBe(200);
      return (await res.json()) as SpendingData;
    };
    // Ids differ between the fake and Firefly III: compare the bill and the account by name.
    const byName = (d: SpendingData) => {
      const names = new Map(d.accounts.map((a) => [a.id, a.name]));
      return d.subscriptions.map((s) => ({
        ...s,
        id: "",
        lastPayment: s.lastPayment && { ...s.lastPayment, account: names.get(s.lastPayment.account) },
      }));
    };

    it("gives the same subscriptions as the fake does for the same seed, ids apart", async () => {
      const fakeClient = createFireflyClient({
        baseUrl: "http://f",
        token: "fake-token",
        fetch: createFakeFirefly(exampleSeed).fetch,
      });
      const expected = await readSpendingData(fakeClient, settings, R1, { today, warn: () => {} });
      const actual = await served();
      expect(actual.subscriptions.length).toBeGreaterThan(0);
      expect(byName(actual)).toEqual(byName(expected));
    });

    it("gives Husleje's last payment in øre with its category and account, and leaves an inactive one out", async () => {
      const d = await served();
      const husleje = d.subscriptions.find((s) => s.name === "Husleje")!;
      const kontoA = d.accounts.find((a) => a.name === "Konto A")!.id;
      expect(husleje.lastPayment).toEqual({ date: "2025-12-30", amount: 800000, category: "Husleje", account: kontoA });
      expect(d.subscriptions.map((s) => s.name)).not.toContain("Avis");
    });

    it("lists a bill's paid dates only inside the window asked for", async () => {
      const inWindow = async (start: string, end: string) =>
        ((await client.get("bills", { start, end, limit: "50" })) as WirePage<WireBill>).data.flatMap((b) =>
          (b.attributes.paid_dates ?? []).map((p) => p.date.slice(0, 10)));
      const wide = await inWindow("2025-01-01", "2026-12-31");
      const narrow = await inWindow("2026-01-01", "2026-01-31");
      expect(wide.length).toBeGreaterThan(narrow.length);
      expect(narrow.length).toBeGreaterThan(0);
      for (const d of narrow) expect(d >= "2026-01-01" && d <= "2026-01-31").toBe(true);
    });
  });

  it("maps a refused token and an unreachable Firefly III", async () => {
    const refused = readVersion(createFireflyClient({ baseUrl: url, token: "wrong" }));
    await expect(refused).rejects.toBeInstanceOf(FireflyError);
    await expect(refused).rejects.toMatchObject({ reason: "refused" });
    const away = readVersion(createFireflyClient({ baseUrl: "http://127.0.0.1:1", token }));
    await expect(away).rejects.toMatchObject({ reason: "unreachable" });
  });
});

// After the reads above, which count the example dataset: these postings are dated after their periods.
describe("the sorter's tools on a real Firefly III", () => {
  const KEY = "made-up-sorter-key-made-up-sorter-key";
  let call: (name: string, args: unknown) => Promise<{ isError: boolean; value: Record<string, unknown> }>;
  let ids: Map<string, number>;

  const splits = async () => {
    const query = { start: "2026-11-01", end: "2026-11-30", type: "all", limit: "50" };
    const page = (await client.get("transactions", query)) as WirePage<WireGroup>;
    return new Map<string, WireSplit>(page.data.flatMap((g) => g.attributes.transactions.map((t) => [t.description, t])));
  };
  const posting = async (description: string) => Number((await splits()).get(description)!.transaction_journal_id);

  beforeAll(async () => {
    const tagRule = (category: string, tag: string) => ({
      title: `Sortering: ${category} → ${tag}`,
      active: true,
      triggers: [{ type: "category_is", value: category }],
      actions: [{ type: "add_tag", value: tag }],
    });
    await seedFirefly(url, token, {
      accounts: [],
      categories: ["Til sortering"],
      ruleGroups: [
        {
          title: "Sorteringsgrupper",
          rules: [tagRule("Dagligvarer", "Mad"), tagRule("Husleje", "Bolig"), tagRule("Til sortering", "Til sortering")],
        },
      ],
      transactions: [
        { splits: [{ type: "withdrawal", date: "2026-11-02", amount: "99.95", description: "Integration køb",
          source: "Konto A", destination: "Butik X", notes: "Banken: Dagligvarer", tags: ["Kvittering", "Bolig"] }] },
        { splits: [{ type: "deposit", date: "2026-11-03", amount: "10.00", description: "Integration refusion",
          source: "Butik Y", destination: "Konto B", category: "Til sortering" }] },
        {
          groupTitle: "Integration delt",
          splits: [
            { type: "withdrawal", date: "2026-11-04", amount: "20.00", description: "Integration del 1",
              source: "Konto A", destination: "Butik Z" },
            { type: "withdrawal", date: "2026-11-04", amount: "30.00", description: "Integration del 2",
              source: "Konto A", destination: "Butik Z", tags: ["Ferie"] },
          ],
        },
        { splits: [{ type: "transfer", date: "2026-11-05", amount: "70.00", description: "Integration overførsel",
          source: "Konto A", destination: "Konto B" }] },
      ],
    });
    const tools = createSorterTools(client, {
      mainGroupRuleGroup: "Sorteringsgrupper",
      excludedMainGroups: ["Penge ind og ud"],
      inboxCategory: "Til sortering",
      pageSize: 5,
      timeoutMs: 30_000,
    }, () => {});
    const app = createSorterApp({ key: KEY, tools, log: () => {} });
    call = async (name, args) => {
      const res = await app.request("/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
      return { isError: body.result.isError === true, value: JSON.parse(body.result.content[0].text) };
    };
    const categories = (await client.get("categories", { limit: "50" })) as WirePage<WireCategory>;
    ids = new Map(categories.data.map((c) => [c.attributes.name, Number(c.id)]));
  });

  const tree = () => [
    { id: ids.get("Dagligvarer")!, name: "Dagligvarer", group: "Mad" },
    { id: ids.get("Husleje")!, name: "Husleje", group: "Bolig" },
  ];

  it("finds the inbox with Firefly III's search, oldest first, without transfers", async () => {
    const { isError, value } = await call("start", { categories: tree() });
    expect(isError).toBe(false);
    expect(value.ok).toBe(true);
    const postings = value.postings as Record<string, unknown>[];
    expect(postings.map((p) => p.description)).toEqual([
      "Løn",
      "Kiosk",
      "Integration køb",
      "Integration refusion",
      "Integration del 1",
      "Integration del 2",
    ]);
    expect(postings[2]).toEqual({
      posting_id: await posting("Integration køb"),
      date: "2026-11-02",
      description: "Integration køb",
      amount: "99.95",
      type: "withdrawal",
      account: "Konto A",
      notes: "Banken: Dagligvarer",
    });
    expect(postings[3]).toMatchObject({ type: "deposit", account: "Konto B", amount: "10.00" });
  });

  it("writes the category and the main group's tag only, and keeps the other split", async () => {
    const before = await splits();
    const given = await call("start", { categories: tree() });
    const amounts = new Map((given.value.postings as { posting_id: number; amount: string }[])
      .map((p) => [p.posting_id, p.amount]));
    const assignments = [
      ["Integration køb", "Dagligvarer"],
      ["Integration del 1", "Husleje"],
      ["Integration overførsel", "Dagligvarer"],
      ["Integration refusion", "Husleje"],
    ].map(([d, c]) => {
      const posting_id = Number(before.get(d)!.transaction_journal_id);
      // A transfer is never given out; it is refused before its amount is looked at.
      return { posting_id, category_id: ids.get(c)!, amount: amounts.get(posting_id) ?? "1.00" };
    });
    const { isError, value } = await call("set_category", { assignments });
    expect(isError).toBe(false);
    expect((value.results as { ok: boolean; reason?: string }[]).map((r) => r.reason ?? r.ok)).toEqual([
      true,
      true,
      "transfer",
      true,
    ]);

    const after = await splits();
    const unchanged = (s: WireSplit) => [s.amount, s.date, s.description, s.notes, s.source_id, s.destination_id];
    const buy = after.get("Integration køb")!;
    expect(buy.category_name).toBe("Dagligvarer");
    expect([...buy.tags].sort()).toEqual(["Kvittering", "Mad"]);
    expect(unchanged(buy)).toEqual(unchanged(before.get("Integration køb")!));
    expect(after.get("Integration del 1")).toMatchObject({ category_name: "Husleje", tags: ["Bolig"] });
    const second = after.get("Integration del 2")!;
    expect(second).toMatchObject({ category_name: null, tags: ["Ferie"] });
    expect(unchanged(second)).toEqual(unchanged(before.get("Integration del 2")!));
    expect(after.get("Integration refusion")).toMatchObject({ category_name: "Husleje", tags: ["Bolig"] });
    expect(after.get("Integration overførsel")!.category_name).toBeNull();

    const again = await call("start", { categories: tree() });
    expect((again.value.postings as { description: string }[]).map((p) => p.description)).toEqual([
      "Løn",
      "Kiosk",
      "Integration del 2",
    ]);
  });
});

// After the sorter's tests above: these postings are dated in December, after theirs. The tests are independent of
// each other (each gives out its own postings), but they use the earlier describe's categories, rules and Konto A.
describe("the sorter's shop on a real Firefly III", () => {
  const KEY = "made-up-sorter-key-made-up-sorter-key";
  let call: (name: string, args: unknown) => Promise<{ isError: boolean; value: Record<string, unknown> }>;
  let ids: Map<string, number>;

  const query = { start: "2026-12-01", end: "2026-12-31", type: "all", limit: "50" };
  const splits = async () => {
    const page = (await client.get("transactions", query)) as WirePage<WireGroup>;
    return new Map<string, WireSplit>(page.data.flatMap((g) => g.attributes.transactions.map((t) => [t.description, t])));
  };
  const accounts = () => readAccounts(client, { pageSize: 50 }, AbortSignal.timeout(30_000));
  const accountsOfType = async (type: string) =>
    (await accounts()).filter((a) => a.type === type).map((a) => a.name);
  const unchanged = (s: WireSplit) => [s.amount, s.date, s.description, s.notes, s.source_id, s.type];

  beforeAll(async () => {
    await seedFirefly(url, token, {
      accounts: [],
      otherAccounts: [
        { name: "Lån Bank", type: "liabilities", active: true },
        { name: "Lukket Butik", type: "expense", active: false },
      ],
      categories: [],
      ruleGroups: [],
      transactions: [
        { splits: [{ type: "withdrawal", date: "2026-12-02", amount: "41.50", description: "Shop køb 1",
          source: "Konto A", notes: "Banken: Butik Ny", tags: ["Kvittering", "Bolig"] }] },
        { splits: [{ type: "withdrawal", date: "2026-12-08", amount: "15.00", description: "Shop nyt",
          source: "Konto A", notes: "Banken: Butik Rep", tags: ["Kvittering", "Bolig"] }] },
        { splits: [{ type: "withdrawal", date: "2026-12-03", amount: "12.00", description: "Shop køb 2",
          source: "Konto A" }] },
        {
          groupTitle: "Shop delt",
          splits: [
            { type: "withdrawal", date: "2026-12-04", amount: "20.00", description: "Shop del 1", source: "Konto A" },
            { type: "withdrawal", date: "2026-12-04", amount: "30.00", description: "Shop del 2", source: "Konto A",
              destination: "Butik Z", tags: ["Ferie"] },
          ],
        },
        { splits: [{ type: "withdrawal", date: "2026-12-05", amount: "50.00", description: "Shop gæld",
          source: "Konto A" }] },
        { splits: [{ type: "withdrawal", date: "2026-12-06", amount: "60.00", description: "Shop lukket",
          source: "Konto A" }] },
        { splits: [{ type: "withdrawal", date: "2026-12-07", amount: "70.00", description: "Shop kendt",
          source: "Konto A", destination: "Butik X" }] },
        { splits: [{ type: "withdrawal", date: "2026-12-09", amount: "80.00", description: "Shop kontant navn",
          source: "Konto A" }] },
      ],
    });
    const tools = createSorterTools(client, {
      mainGroupRuleGroup: "Sorteringsgrupper",
      excludedMainGroups: ["Penge ind og ud"],
      inboxCategory: "Til sortering",
      pageSize: 5,
      timeoutMs: 30_000,
    }, () => {});
    const app = createSorterApp({ key: KEY, tools, log: () => {} });
    call = async (name, args) => {
      const res = await app.request("/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
      return { isError: body.result.isError === true, value: JSON.parse(body.result.content[0].text) };
    };
    const categories = (await client.get("categories", { limit: "50" })) as WirePage<WireCategory>;
    ids = new Map(categories.data.map((c) => [c.attributes.name, Number(c.id)]));
  });

  const tree = () => [
    { id: ids.get("Dagligvarer")!, name: "Dagligvarer", group: "Mad" },
    { id: ids.get("Husleje")!, name: "Husleje", group: "Bolig" },
  ];
  // `start` gives the postings out, which `set_category` needs, and says each one's amount.
  const given = async () => {
    const { value } = await call("start", { categories: tree() });
    return { value, amounts: new Map((value.postings as { posting_id: number; amount: string }[])
      .map((p) => [p.posting_id, p.amount])) };
  };
  const assignment = (before: Map<string, WireSplit>, amounts: Map<number, string>, description: string, shop?: string) => {
    const posting_id = Number(before.get(description)!.transaction_journal_id);
    return { posting_id, category_id: ids.get("Dagligvarer")!, amount: amounts.get(posting_id)!,
      ...(shop === undefined ? {} : { shop }) };
  };

  it("reads a withdrawal on the importer's literal (no name) as an expense account, and takes a shop", async () => {
    const before = await splits();
    const first = before.get("Shop køb 1")!;
    expect(first.destination_name).toBe("(no name)");
    expect(first.destination_type).toBe("Expense account");

    const { value, amounts } = await given();
    expect(value.ok).toBe(true);
    const answer = await call("set_category", { assignments: [assignment(before, amounts, "Shop køb 1", "Butik Ny")] });
    expect(answer.isError).toBe(false);
    expect(answer.value.results).toEqual([{ posting_id: Number(first.transaction_journal_id), ok: true, shop: "Butik Ny" }]);
    expect((await splits()).get("Shop køb 1")).toMatchObject({ destination_name: "Butik Ny", destination_type: "Expense account" });
  });

  it("set_category with a shop makes the expense account, a second posting with the same shop reuses it, and the " +
    "amount, date, source account, type, category, tags, notes and the other split stay", async () => {
    const before = await splits();
    const { amounts } = await given();
    const expenseCount = (await accountsOfType("expense")).length;

    const answer = await call("set_category", {
      assignments: [
        assignment(before, amounts, "Shop nyt", "Butik Rep"),
        assignment(before, amounts, "Shop køb 2", "butik rep"),
        assignment(before, amounts, "Shop del 1", "Butik Del"),
      ],
    });
    expect(answer.isError).toBe(false);
    expect((answer.value.results as { ok: boolean; shop?: string }[]).map((r) => r.shop))
      .toEqual(["Butik Rep", "Butik Rep", "Butik Del"]);

    const after = await splits();
    expect(after.get("Shop køb 2")!.destination_id).toBe(after.get("Shop nyt")!.destination_id);
    // One account for the first two postings, one new for the split: the count rose by two only.
    expect((await accountsOfType("expense")).length).toBe(expenseCount + 2);

    const made = after.get("Shop nyt")!;
    expect(made).toMatchObject({ category_name: "Dagligvarer", destination_name: "Butik Rep" });
    expect(unchanged(made)).toEqual(unchanged(before.get("Shop nyt")!));
    expect(made.source_name).toBe("Konto A");
    expect([...made.tags].sort()).toEqual(["Kvittering", "Mad"]);
    const reused = after.get("Shop køb 2")!;
    expect(reused).toMatchObject({ category_name: "Dagligvarer", destination_name: "Butik Rep" });
    expect(unchanged(reused)).toEqual(unchanged(before.get("Shop køb 2")!));
    const one = after.get("Shop del 1")!;
    expect(one).toMatchObject({ destination_name: "Butik Del", category_name: "Dagligvarer" });
    expect(unchanged(one)).toEqual(unchanged(before.get("Shop del 1")!));
    const other = after.get("Shop del 2")!;
    expect(other).toMatchObject({ destination_name: "Butik Z", category_name: null, tags: ["Ferie"] });
    expect(unchanged(other)).toEqual(unchanged(before.get("Shop del 2")!));
  });

  it("a liability's name and an inactive expense account's name are name-taken, and the destination stays", async () => {
    const before = await splits();
    const { amounts } = await given();
    const answer = await call("set_category", {
      assignments: [
        assignment(before, amounts, "Shop gæld", "Lån Bank"),
        assignment(before, amounts, "Shop lukket", "Lukket Butik"),
        assignment(before, amounts, "Shop kendt", "Butik Ny"),
      ],
    });
    expect(answer.isError).toBe(false);
    const results = answer.value.results as { shop_refused?: string; ok: boolean }[];
    expect(results.map((r) => r.shop_refused)).toEqual(["name-taken", "name-taken", "has-shop"]);
    const after = await splits();
    for (const d of ["Shop gæld", "Shop lukket", "Shop kendt"]) {
      expect(after.get(d)!.destination_id).toBe(before.get(d)!.destination_id);
      expect(after.get(d)!.category_name).toBe("Dagligvarer");
    }
    expect(await accountsOfType("expense")).not.toContain("Lån Bank");
  });

  it("sends a withdrawal made through the API without a destination to the cash account, which keeps it (has-shop) " +
    "and whose name is name-taken", async () => {
    await client.post("transactions", { apply_rules: false, transactions: [{ type: "withdrawal", date: "2026-12-10",
      amount: "90.00", description: "Shop kontant", source_name: "Konto A" }] });
    const before = await splits();
    const cash = before.get("Shop kontant")!;
    expect([cash.destination_type, cash.destination_name]).toEqual(["Cash account", "Cash account"]);
    const listed = (await accounts()).find((a) => a.id === cash.destination_id);
    expect(listed).toMatchObject({ name: "Cash account", type: "cash" });

    const { amounts } = await given();
    const answer = await call("set_category", {
      assignments: [
        assignment(before, amounts, "Shop kontant", "Butik Ny"),
        assignment(before, amounts, "Shop kontant navn", cash.destination_name),
      ],
    });
    expect(answer.isError).toBe(false);
    expect((answer.value.results as { shop_refused?: string }[]).map((r) => r.shop_refused))
      .toEqual(["has-shop", "name-taken"]);
    const after = await splits();
    expect(after.get("Shop kontant")!.destination_id).toBe(cash.destination_id);
    expect(after.get("Shop kontant navn")!.destination_id).toBe(before.get("Shop kontant navn")!.destination_id);
  });

  it("sends no shop for (no name) or a cash account", async () => {
    const december = await read({ start: "2026-12-01", end: "2026-12-31" });
    const shopOf = (text: string) => december.postings.find((p) => p.text === text)?.shop;
    expect(shopOf("Shop gæld")).toBeNull();
    expect(shopOf("Shop kontant")).toBeNull();
  });
});

// In January 2027, after every posting above, with the first sorter describe's categories and rules.
describe("the chat's tools on a real Firefly III", () => {
  const KEY = "made-up-sorter-key-made-up-sorter-key";
  const WRITTEN = new Set(["category_id", "category_name", "tags", "notes"]);
  const JANUARY = { start: "2027-01-01", end: "2027-01-31" };
  let call: (name: string, args: unknown) => Promise<{ isError: boolean; value: Record<string, unknown> }>;
  let ids: Map<string, number>;

  const splits = async () => {
    const page = (await client.get("transactions", { ...JANUARY, type: "all", limit: "50" })) as WirePage<WireGroup>;
    return new Map<string, WireSplit>(
      page.data.flatMap((g) => g.attributes.transactions.map((t) => [t.description, t])),
    );
  };

  beforeAll(async () => {
    await seedFirefly(url, token, {
      accounts: [],
      categories: [],
      ruleGroups: [],
      transactions: [
        { splits: [{ type: "withdrawal", date: "2027-01-05", amount: "38.00", description: "Chat kaffe",
          source: "Konto A", destination: "Café Chat", category: "Dagligvarer", notes: "Banken: kaffe",
          tags: ["Kvittering"] }] },
        { splits: [{ type: "deposit", date: "2027-01-06", amount: "10.00", description: "Chat retur",
          source: "Café Chat", destination: "Konto A", category: "Dagligvarer" }] },
        {
          groupTitle: "Chat delt",
          splits: [
            { type: "withdrawal", date: "2027-01-07", amount: "20.00", description: "Chat del 1", source: "Konto A",
              destination: "Butik Z", category: "Dagligvarer" },
            { type: "withdrawal", date: "2027-01-07", amount: "30.00", description: "Chat del 2", source: "Konto A",
              destination: "Butik Z", category: "Dagligvarer" },
          ],
        },
      ],
    });
    const settings = {
      mainGroupRuleGroup: "Sorteringsgrupper",
      excludedMainGroups: ["Penge ind og ud"],
      inboxCategory: "Til sortering",
      pageSize: 5,
      timeoutMs: 30_000,
      movedTag: "moved-by-assistant",
    };
    const tools = createChatTools(client, settings, () => {}, () => new Date(2026, 10, 1, 12));
    const app = createSorterApp({ key: KEY, tools, log: () => {} });
    call = async (name, args) => {
      const res = await app.request("/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
      return { isError: body.result.isError === true, value: JSON.parse(body.result.content[0].text) };
    };
    const categories = (await client.get("categories", { limit: "50" })) as WirePage<WireCategory>;
    ids = new Map(categories.data.map((c) => [c.attributes.name, Number(c.id)]));
  });

  it("finds the postings, reads one and sums the month", async () => {
    const found = await call("find_postings", { ...JANUARY, text: "chat" });
    expect((found.value.postings as { description: string }[]).map((p) => p.description)).toEqual([
      "Chat del 2",
      "Chat del 1",
      "Chat retur",
      "Chat kaffe",
    ]);
    const coffee = Number((await splits()).get("Chat kaffe")!.transaction_journal_id);
    expect((await call("get_posting", { posting_id: coffee })).value).toMatchObject({
      posting_id: coffee,
      date: "2027-01-05",
      type: "withdrawal",
      amount: "38.00",
      category: "Dagligvarer",
      main_group: "Mad",
      shop: "Café Chat",
      notes: "Banken: kaffe",
    });
    expect((await call("spending", { ...JANUARY, by: "main_group" })).value).toEqual({
      rows: [{ name: "Mad", amount: "78.00" }],
      more: false,
      total: "78.00",
    });
  });

  it("moves a posting: the category, the tags and one more line of notes, nothing else", async () => {
    const before = await splits();
    const coffee = before.get("Chat kaffe")!;
    const { isError, value } = await call("move_posting", {
      posting_id: Number(coffee.transaction_journal_id),
      amount: "38.00",
      category_id: ids.get("Husleje")!,
      reason: "Kaffe til udlejeren",
    });
    expect(isError).toBe(false);
    expect(value).toEqual({ ok: true, from: "Dagligvarer", to: "Husleje" });

    const after = (await splits()).get("Chat kaffe")!;
    expect(after.category_name).toBe("Husleje");
    expect([...after.tags].sort()).toEqual(["Bolig", "Kvittering", "moved-by-assistant"]);
    expect(after.notes).toBe("Banken: kaffe\n2026-11-01: Dagligvarer → Husleje. Kaffe til udlejeren");
    // Every other field Firefly III answers, not only those the add-on reads.
    const rest = (split: WireSplit) =>
      Object.fromEntries(Object.entries(split).filter(([key]) => !WRITTEN.has(key) && !key.endsWith("updated_at")));
    expect(Object.keys(rest(coffee)).length).toBeGreaterThan(20);
    expect(rest(after)).toEqual(rest(coffee));
  });

  it("refuses a part of a split posting, and writes nothing", async () => {
    const before = await splits();
    const { value } = await call("move_posting", {
      posting_id: Number(before.get("Chat del 1")!.transaction_journal_id),
      amount: "20.00",
      category_id: ids.get("Husleje")!,
      reason: "En grund",
    });
    expect(value).toEqual({ error: "split" });
    expect(await splits()).toEqual(before);
  });
});
