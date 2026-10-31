import { describe, expect, it } from "vitest";
import { createFakeFirefly } from "../src/fake";
import { exampleSeed } from "../src/example";
import { generateSeed } from "../src/generate";

const token = "fake-token";

interface Split {
  transaction_journal_id: string;
  type: string;
  date: string;
  amount: string;
  currency_code: string;
  foreign_amount: string | null;
  foreign_currency_code: string | null;
  source_type: string;
  destination_type: string;
  category_name: string | null;
  description: string;
}

interface Group {
  id: string;
  attributes: { group_title: string | null; transactions: Split[] };
}

interface Page<T> {
  data: T[];
  meta: {
    pagination: { total: number; count: number; per_page: number; current_page: number; total_pages: number };
  };
}

function client(fake = createFakeFirefly(exampleSeed)) {
  const get = (path: string, init: RequestInit = {}) =>
    fake.fetch(`http://f/api/v1/${path}`, { headers: { Authorization: `Bearer ${token}` }, ...init });
  const json = async <T>(path: string) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    return (await res.json()) as T;
  };
  return { fake, get, json };
}

const allTransactions = "transactions?start=2025-01-01&end=2026-12-31&type=all";

async function allGroups(): Promise<Group[]> {
  return (await client().json<Page<Group>>(allTransactions)).data;
}

function byDescription(groups: Group[], description: string): Group {
  const group = groups.find((g) => g.attributes.transactions.some((s) => s.description === description));
  if (!group) throw new Error(`no group with ${description}`);
  return group;
}

describe("the fake Firefly III", () => {
  it("pages the transactions newest first", async () => {
    const { json } = client();
    const first = await json<Page<Group>>(`${allTransactions}&limit=5&page=1`);
    expect(first.meta.pagination).toEqual({ total: 16, count: 5, per_page: 5, current_page: 1, total_pages: 4 });
    expect(first.data[0].attributes.transactions[0].date).toBe("2026-07-01T00:00:00+02:00");

    const last = await json<Page<Group>>(`${allTransactions}&limit=5&page=4`);
    expect(last.meta.pagination.count).toBe(1);
    expect(last.data).toHaveLength(1);

    const past = await json<Page<Group>>(`${allTransactions}&limit=5&page=5`);
    expect(past.data).toEqual([]);
  });

  it("answers a split in Firefly III shapes", async () => {
    const groups = await allGroups();

    const groceries = byDescription(groups, exampleSeed.transactions[0].splits[0].description);
    expect(groceries.attributes.group_title).toBeNull();
    expect(groceries.attributes.transactions).toHaveLength(1);
    expect(groceries.attributes.transactions[0]).toMatchObject({
      amount: "412.500000000000",
      currency_code: "DKK",
      type: "withdrawal",
      date: "2025-12-03T00:00:00+01:00",
      source_type: "Asset account",
      destination_type: "Expense account",
      category_name: "Dagligvarer",
      foreign_amount: null,
      foreign_currency_code: null,
    });

    const split = groups.find((g) => g.attributes.group_title === "Indkøb");
    expect(split?.attributes.transactions).toHaveLength(2);
    const [one, two] = split!.attributes.transactions;
    expect(one.transaction_journal_id).not.toBe(two.transaction_journal_id);
    expect([one.category_name, two.category_name]).toEqual(["Dagligvarer", "Gaver"]);

    const foreign = byDescription(groups, exampleSeed.transactions[11].splits[0].description);
    expect(foreign.attributes.transactions[0]).toMatchObject({
      amount: "745.000000000000",
      foreign_amount: "100.000000000000",
      foreign_currency_code: "EUR",
    });
  });

  it("tells a refund, a transfer and a posting without category apart", async () => {
    const groups = await allGroups();
    expect(byDescription(groups, exampleSeed.transactions[3].splits[0].description).attributes.transactions[0])
      .toMatchObject({ type: "deposit", source_type: "Revenue account", destination_type: "Asset account" });
    expect(byDescription(groups, exampleSeed.transactions[9].splits[0].description).attributes.transactions[0])
      .toMatchObject({ type: "transfer", source_type: "Asset account", destination_type: "Asset account" });
    expect(
      byDescription(groups, exampleSeed.transactions[12].splits[0].description).attributes.transactions[0]
        .category_name,
    ).toBeNull();
  });

  it("filters by date", async () => {
    const page = await client().json<Page<Group>>("transactions?start=2026-01-01&end=2026-01-31&type=all");
    expect(page.meta.pagination.total).toBe(8);
    const dates = page.data.map((g) => g.attributes.transactions[0].date.slice(0, 10));
    expect(dates.every((d) => d >= "2026-01-01" && d <= "2026-01-31")).toBe(true);
  });

  it("caps the page size when told", async () => {
    const { json } = client(createFakeFirefly(exampleSeed, { maxPerPage: 3 }));
    const page = await json<Page<Group>>(`${allTransactions}&limit=500`);
    expect(page.meta.pagination.per_page).toBe(3);
    expect(page.meta.pagination.total_pages).toBe(6);
  });

  it("lists accounts and categories 50 to a page", async () => {
    const { json } = client();
    const accounts = await json<Page<{ attributes: { name: string; type: string; active: boolean } }>>(
      "accounts?type=asset",
    );
    expect(accounts.data).toHaveLength(3);
    expect(accounts.data.find((a) => a.attributes.name === "Konto C")?.attributes.active).toBe(false);
    expect(accounts.data.every((a) => a.attributes.type === "asset")).toBe(true);
    expect(accounts.meta.pagination.per_page).toBe(50);

    const categories = await json<Page<{ attributes: { name: string } }>>("categories");
    expect(categories.data).toHaveLength(9);
    expect(categories.meta.pagination.per_page).toBe(50);
  });

  it("leaves inactive accounts out when told", async () => {
    const { json } = client(createFakeFirefly(exampleSeed, { hideInactiveAccounts: true }));
    const accounts = await json<Page<{ attributes: { name: string } }>>("accounts?type=asset");
    expect(accounts.data.map((a) => a.attributes.name)).toEqual(["Konto A", "Konto B"]);
  });

  it("lists the rules of a rule group in order", async () => {
    const { json } = client();
    const groups = await json<Page<{ id: string; attributes: { title: string } }>>("rule-groups");
    expect(groups.data.map((g) => g.attributes.title)).toEqual(["Hovedgrupper", "Andet"]);

    const rules = await json<
      Page<{ attributes: { active: boolean; actions: { type: string; value: string; active: boolean }[] } }>
    >(`rule-groups/${groups.data[0].id}/rules`);
    expect(rules.data).toHaveLength(11);
    expect(rules.data[8].attributes.active).toBe(false);
    expect(rules.data[0].attributes.actions).toEqual([{ type: "add_tag", value: "Mad", active: true }]);
  });

  it("refuses a missing or wrong token", async () => {
    const { fake } = client();
    const missing = await fake.fetch("http://f/api/v1/about");
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ message: "Unauthenticated.", exception: "AuthenticationException" });

    const wrong = await fake.fetch("http://f/api/v1/about", { headers: { Authorization: "Bearer nope" } });
    expect(wrong.status).toBe(401);
  });

  it("refuses anything but GET and records it", async () => {
    const { fake, get } = client();
    const res = await get("transactions", { method: "POST", body: "{}" });
    expect(res.status).toBe(405);
    expect(fake.requests.at(-1)).toEqual({ method: "POST", path: "/api/v1/transactions" });
  });

  it("answers the faults", async () => {
    const { fake, get } = client();
    fake.fault = "refused";
    expect((await get("about")).status).toBe(401);
    fake.fault = "error";
    expect((await get("about")).status).toBe(500);
    fake.fault = "slow";
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await expect(get("about", { signal: controller.signal })).rejects.toThrow();
  });

  it("serves the generated data", async () => {
    const fake = createFakeFirefly(generateSeed({ today: "2026-10-30", seed: 1 }));
    const page = await client(fake).json<Page<Group>>(allTransactions);
    expect(page.meta.pagination.total).toBeGreaterThan(100);
  });

  it("gives Copenhagen's offset on the days summer time starts and ends", async () => {
    const split = (date: string) => ({ type: "withdrawal" as const, date, amount: "1", description: date,
      source: "Konto A", destination: "Netto" });
    const fake = createFakeFirefly({ ...exampleSeed, transactions: [{ splits: [split("2026-03-29")] },
      { splits: [split("2026-03-30")] }, { splits: [split("2026-10-25")] }, { splits: [split("2026-10-26")] }] });
    const page = await client(fake).json<Page<Group>>(allTransactions);
    expect(page.data.map((g) => g.attributes.transactions[0].date)).toEqual([
      "2026-10-26T00:00:00+01:00",
      "2026-10-25T00:00:00+02:00",
      "2026-03-30T00:00:00+02:00",
      "2026-03-29T00:00:00+01:00",
    ]);
    expect(page.data[0].attributes.transactions[0].amount).toBe("1.000000000000");
  });

  it.each([
    ["withdrawal", 11],
    ["deposit", 4],
    ["transfer", 2],
    ["all", 17],
  ])("filters the transactions by type %s", async (type, count) => {
    const page = await client().json<Page<Group>>(`transactions?start=1900-01-01&end=2026-12-31&type=${type}`);
    expect(page.data).toHaveLength(count);
    if (type !== "all") {
      expect(page.data.every((g) => g.attributes.transactions.every((s) => s.type === type))).toBe(true);
    }
  });

  it("tells its version", async () => {
    const about = await client().json<{ data: { version: string } }>("about");
    expect(about.data.version).toBe("6.7.9");
  });

  it("answers a transaction's page outside the API", async () => {
    const res = await client().fake.fetch("http://f/transactions/show/7");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
