import { describe, expect, it } from "vitest";
import { createFakeFirefly } from "../src/fake";
import { exampleSeed } from "../src/example";
import { generateSeed } from "../src/generate";
import type { SeedData } from "../src/seed-types";

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
  category_id: string | null;
  category_name: string | null;
  description: string;
  tags: string[];
  notes: string | null;
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
    expect(first.meta.pagination).toEqual({ total: 18, count: 5, per_page: 5, current_page: 1, total_pages: 4 });
    expect(first.data[0].attributes.transactions[0].date).toBe("2026-09-15T00:00:00+02:00");

    const last = await json<Page<Group>>(`${allTransactions}&limit=5&page=4`);
    expect(last.meta.pagination.count).toBe(3);
    expect(last.data).toHaveLength(3);

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

  it("refuses anything but GET and a group's PUT, and records it", async () => {
    const { fake, get } = client();
    const res = await get("transactions", { method: "POST", body: "{}" });
    expect(res.status).toBe(405);
    expect(fake.requests.at(-1)).toEqual({ method: "POST", path: "/api/v1/transactions" });
    expect((await get("categories/1", { method: "PUT", body: "{}" })).status).toBe(405);
  });

  it("searches by no category, a category, a journal and a type", async () => {
    const { json } = client();
    const search = async (query: string) =>
      (await json<Page<Group>>(`search/transactions?query=${encodeURIComponent(query)}`)).data
        .flatMap((g) => g.attributes.transactions)
        .map((s) => s.description);
    expect(await search("-has_any_category:true")).toEqual([
      "Kiosk",
      "Overførsel til Konto B",
      "Løn",
      "Første overførsel",
    ]);
    expect(await search("-has_any_category:true type:deposit")).toEqual(["Løn"]);
    expect(await search('category_is:"Café"')).toEqual(["Hotel i Berlin", "Kaffe og kage"]);
    const bilka = byDescription(await allGroups(), "Bilka gave").attributes.transactions[1];
    expect(await search(`journal_id:${bilka.transaction_journal_id}`)).toEqual(["Bilka gave"]);
  });

  it("refuses a search it does not know", async () => {
    const { get } = client();
    for (const query of ["Netto", "has_no_category:true", "category_is:Café extra"]) {
      expect((await get(`search/transactions?query=${encodeURIComponent(query)}`)).status).toBe(422);
    }
  });

  it("answers one group with all its splits", async () => {
    const { json, get } = client();
    const bilka = byDescription(await allGroups(), "Bilka mad");
    const one = await json<{ data: Group }>(`transactions/${bilka.id}`);
    expect(one.data).toEqual({ id: bilka.id, attributes: bilka.attributes });
    expect((await get("transactions/99999")).status).toBe(404);
  });

  it("puts a category and tags, and deletes a split the put does not list, as Firefly III does", async () => {
    const { fake, json, get } = client();
    const categories = (await json<Page<{ id: string; attributes: { name: string } }>>("categories")).data;
    const tandlaege = categories.find((c) => c.attributes.name === "Tandlæge")!.id;
    const bilka = byDescription(await allGroups(), "Bilka mad");
    const [food, gift] = bilka.attributes.transactions;
    const put = (body: unknown) =>
      get(`transactions/${bilka.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    expect((await put({ transactions: [{ transaction_journal_id: food.transaction_journal_id, amount: "1" }] })).status)
      .toBe(422);
    expect((await put({ transactions: [{ transaction_journal_id: "99999" }] })).status).toBe(422);

    const untitled = {
      transactions: [
        { transaction_journal_id: food.transaction_journal_id, category_id: tandlaege },
        { transaction_journal_id: gift.transaction_journal_id },
      ],
    };
    expect((await put(untitled)).status).toBe(422);

    const body = {
      apply_rules: false,
      group_title: "Indkøb",
      transactions: [
        { transaction_journal_id: food.transaction_journal_id, category_id: tandlaege, tags: ["Sundhed"] },
        { transaction_journal_id: gift.transaction_journal_id },
      ],
    };
    expect((await put(body)).status).toBe(200);
    expect(fake.requests.at(-1)).toEqual({ method: "PUT", path: `/api/v1/transactions/${bilka.id}`, body });
    let after = (await json<{ data: Group }>(`transactions/${bilka.id}`)).data.attributes.transactions;
    expect(after.map((s) => [s.category_name, s.tags, s.amount])).toEqual([
      ["Tandlæge", ["Sundhed"], food.amount],
      [gift.category_name, gift.tags, gift.amount],
    ]);

    expect((await put({ transactions: [{ transaction_journal_id: gift.transaction_journal_id }] })).status).toBe(200);
    after = (await json<{ data: Group }>(`transactions/${bilka.id}`)).data.attributes.transactions;
    expect(after.map((s) => s.description)).toEqual(["Bilka gave"]);
  });

  describe("accounts of every type", () => {
    interface AccountAttributes {
      name: string;
      type: string;
      active: boolean;
      currency_code: string;
    }
    type Accounts = Page<{ id: string; attributes: AccountAttributes }>;

    const seed = (): SeedData => ({
      accounts: [{ name: "Konto A", active: true }],
      categories: ["Dagligvarer"],
      ruleGroups: [],
      otherAccounts: [
        { name: "Boliglån", type: "liabilities", active: true },
        { name: "Lukket butik", type: "expense", active: false },
        { name: "Gammel kunde", type: "revenue", active: true },
      ],
      transactions: [
        {
          splits: [
            { type: "withdrawal", date: "2026-01-05", amount: "10.00", description: "Brød", source: "Konto A",
              destination: "Bager", category: "Dagligvarer" },
          ],
        },
        {
          splits: [
            { type: "withdrawal", date: "2026-01-06", amount: "20.00", description: "Mælk", source: "Konto A" },
          ],
        },
        {
          splits: [
            { type: "deposit", date: "2026-01-07", amount: "30.00", description: "Løn", source: "Firma",
              destination: "Konto A" },
          ],
        },
      ],
    });

    const named = (accounts: Accounts) => accounts.data.map((a) => `${a.attributes.type}:${a.attributes.name}`).sort();
    const post = (get: ReturnType<typeof client>["get"], body: unknown) =>
      get("accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("lists expense accounts, also those only a split names", async () => {
      const { json } = client(createFakeFirefly(seed()));
      const accounts = await json<Accounts>("accounts?type=expense");
      expect(named(accounts)).toEqual(["expense:(no name)", "expense:Bager", "expense:Lukket butik"]);
      expect(accounts.data.find((a) => a.attributes.name === "Lukket butik")?.attributes.active).toBe(false);
      expect(accounts.data.find((a) => a.attributes.name === "Bager")?.attributes).toEqual({
        name: "Bager",
        type: "expense",
        active: true,
        currency_code: "DKK",
      });
      expect(named(await json<Accounts>("accounts?type=revenue"))).toEqual(["revenue:Firma", "revenue:Gammel kunde"]);
      expect(named(await json<Accounts>("accounts?type=liabilities"))).toEqual(["liabilities:Boliglån"]);
      expect(named(await json<Accounts>("accounts"))).toEqual(["asset:Konto A"]);
    });

    it("lists every type with type=all", async () => {
      const { json } = client(createFakeFirefly(seed(), { maxPerPage: 4 }));
      const first = await json<Accounts>("accounts?type=all");
      expect(first.meta.pagination.total).toBe(7);
      expect(first.meta.pagination.total_pages).toBe(2);
      const second = await json<Accounts>("accounts?type=all&page=2");
      expect(named({ ...first, data: [...first.data, ...second.data] })).toEqual([
        "asset:Konto A",
        "expense:(no name)",
        "expense:Bager",
        "expense:Lukket butik",
        "liabilities:Boliglån",
        "revenue:Firma",
        "revenue:Gammel kunde",
      ]);
    });

    it("POST accounts makes an expense account", async () => {
      const { get, json } = client(createFakeFirefly(seed()));
      const res = await post(get, { name: "Ny butik", type: "expense" });
      expect(res.status).toBe(200);
      const made = (await res.json()) as { data: { id: string; attributes: AccountAttributes } };
      expect(made.data.attributes).toEqual({ name: "Ny butik", type: "expense", active: true, currency_code: "DKK" });
      const listed = await json<Accounts>("accounts?type=expense");
      expect(listed.data.find((a) => a.id === made.data.id)?.attributes.name).toBe("Ny butik");
    });

    it("POST accounts with a taken name is 422", async () => {
      const { get } = client(createFakeFirefly(seed()));
      for (const name of ["Bager", "Konto A", "Boliglån", "Firma", "Lukket butik"]) {
        expect((await post(get, { name, type: "expense" })).status).toBe(422);
      }
      expect((await post(get, { name: "bager", type: "expense" })).status).toBe(200);
      expect((await post(get, { name: "Anden", type: "asset" })).status).toBe(422);
    });

    describe("a PUT with a destination", () => {
      const put = async (fake: ReturnType<typeof createFakeFirefly>, id: string, split: Record<string, unknown>) =>
        fake.fetch(`http://f/api/v1/transactions/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: [split] }),
        });

      async function setup() {
        const fake = createFakeFirefly(seed());
        const { json } = client(fake);
        const groups = (await json<Page<Group>>("transactions?start=2026-01-01&end=2026-01-31&type=all")).data;
        const milk = byDescription(groups, "Mælk");
        const expense = await json<Accounts>("accounts?type=expense");
        const idOf = (name: string) => expense.data.find((a) => a.attributes.name === name)!.id;
        return { fake, json, milk, idOf, split: milk.attributes.transactions[0] };
      }

      it("moves the split", async () => {
        const { fake, json, milk, idOf } = await setup();
        const res = await put(fake, milk.id, { destination_id: idOf("Bager") });
        expect(res.status).toBe(200);
        const after = (await json<{ data: Group }>(`transactions/${milk.id}`)).data.attributes.transactions[0] as
          Split & { destination_id: string; destination_name: string };
        expect(after.destination_id).toBe(idOf("Bager"));
        expect(after.destination_name).toBe("Bager");
        expect(after.destination_type).toBe("Expense account");
      });

      it("is 422 for an unknown destination_id, a non-expense one and a name", async () => {
        const { fake, json, milk, split } = await setup();
        expect((await put(fake, milk.id, { destination_id: "99999" })).status).toBe(422);
        const assets = await json<Accounts>("accounts");
        expect((await put(fake, milk.id, { destination_id: assets.data[0].id })).status).toBe(422);
        expect((await put(fake, milk.id, { destination_name: "Bager" })).status).toBe(422);
        expect((await put(fake, milk.id, { source_id: "1" })).status).toBe(422);
        const after = (await json<{ data: Group }>(`transactions/${milk.id}`)).data.attributes.transactions[0];
        expect(after).toEqual(split);
      });
    });

    it("a withdrawal seeded without a destination reads (no name)", async () => {
      const { json } = client(createFakeFirefly(seed()));
      const groups = (await json<Page<Group>>("transactions?start=2026-01-01&end=2026-01-31&type=all")).data;
      const milk = byDescription(groups, "Mælk").attributes.transactions[0] as Split & {
        destination_name: string;
      };
      expect(milk.destination_name).toBe("(no name)");
      expect(milk.destination_type).toBe("Expense account");
    });

    it("a withdrawal seeded to a listed liability pays that liability, which is listed once", async () => {
      const data = seed();
      data.otherAccounts!.push({ name: "Laan", type: "liabilities", active: true });
      data.transactions.push({ splits: [{ type: "withdrawal", date: "2026-01-08", amount: "40.00",
        description: "Afdrag", source: "Konto A", destination: "Laan" }] });
      const { json } = client(createFakeFirefly(data));
      const groups = (await json<Page<Group>>("transactions?start=2026-01-01&end=2026-01-31&type=all")).data;
      const paid = byDescription(groups, "Afdrag").attributes.transactions[0] as Split & { destination_id: string };
      const all = await json<Accounts>("accounts?type=all");
      const laan = all.data.filter((a) => a.attributes.name === "Laan");
      expect(laan.map((a) => a.attributes.type)).toEqual(["liabilities"]);
      expect(paid).toMatchObject({ destination_id: laan[0].id, destination_name: "Laan", destination_type: "Loan" });
    });
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
    ["withdrawal", 13],
    ["deposit", 4],
    ["transfer", 2],
    ["all", 19],
  ])("filters the transactions by type %s", async (type, count) => {
    const page = await client().json<Page<Group>>(`transactions?start=1900-01-01&end=2026-12-31&type=${type}`);
    expect(page.data).toHaveLength(count);
    if (type !== "all") {
      expect(page.data.every((g) => g.attributes.transactions.every((s) => s.type === type))).toBe(true);
    }
  });

  describe("subscriptions", () => {
    interface Bill {
      id: string;
      attributes: {
        name: string;
        amount_min: string;
        amount_max: string;
        date: string;
        end_date: string | null;
        repeat_freq: string;
        skip: number;
        active: boolean;
        paid_dates: { transaction_group_id: string; transaction_journal_id: string; date: string; amount: string }[];
      };
    }
    const bills = (query = "start=2025-01-01&end=2026-10-30") => client().json<Page<Bill>>(`bills?${query}`);
    const named = (page: Page<Bill>, name: string) => page.data.find((b) => b.attributes.name === name)!;

    it("pages the bills", async () => {
      const first = await bills("start=2025-01-01&end=2026-10-30&limit=4&page=1");
      expect(first.meta.pagination).toEqual({ total: 11, count: 4, per_page: 4, current_page: 1, total_pages: 3 });
      expect(first.data[0].attributes).toMatchObject({
        name: "Husleje",
        amount_min: "8000.000000000000",
        amount_max: "8000.000000000000",
        date: "2025-01-31T00:00:00+01:00",
        end_date: null,
        repeat_freq: "monthly",
        skip: 0,
        active: true,
      });
    });

    it("lists the linked splits dated from start to end, with positive amounts", async () => {
      const page = await bills();
      const groups = await allGroups();
      const rent = named(page, "Husleje").attributes.paid_dates;
      expect(rent).toEqual([
        {
          transaction_group_id: byDescription(groups, "Husleje januar").id,
          transaction_journal_id: byDescription(groups, "Husleje januar").attributes.transactions[0].transaction_journal_id,
          date: "2025-12-30T00:00:00+01:00",
          amount: "8000.000000000000",
        },
      ]);
      expect(named(page, "Indboforsikring").attributes.paid_dates.map((p) => p.date)).toEqual([
        "2026-09-15T00:00:00+02:00",
      ]);
      expect(named(page, "Avis").attributes.paid_dates).toEqual([]);

      const later = await bills("start=2025-01-01&end=2027-12-31");
      expect(named(later, "Indboforsikring").attributes.paid_dates).toHaveLength(2);
      const before = await bills("start=2026-01-03&end=2026-10-30");
      expect(named(before, "Netflix").attributes.paid_dates).toEqual([]);
    });

    it("gives a split of a group its own journal id", async () => {
      const group = byDescription(await allGroups(), "Bilka mad");
      const mad = group.attributes.transactions.find((s) => s.description === "Bilka mad")!;
      const paid = named(await bills(), "Bilka").attributes.paid_dates;
      expect(paid).toEqual([
        {
          transaction_group_id: group.id,
          transaction_journal_id: mad.transaction_journal_id,
          date: "2026-01-10T00:00:00+01:00",
          amount: "200.000000000000",
        },
      ]);
    });

    it("lists an inactive and an ended bill", async () => {
      const page = await bills();
      expect(named(page, "Avis").attributes.active).toBe(false);
      expect(named(page, "Fitness").attributes.end_date).toBe("2026-10-30T00:00:00+01:00");
      expect(named(page, "Gammel forsikring").attributes.end_date).toBe("2026-10-29T00:00:00+01:00");
      expect(named(page, "Hver tredje år").attributes.skip).toBe(2);
    });

    it("takes a withdrawal from a liability as one from a Loan", async () => {
      const loan = byDescription(await allGroups(), "Billån august").attributes.transactions[0];
      expect(loan).toMatchObject({ type: "withdrawal", source_type: "Loan", destination_type: "Expense account" });
    });

    it("refuses a split that names an unknown subscription", () => {
      const split = { type: "withdrawal" as const, date: "2026-01-01", amount: "1", description: "x",
        source: "Konto A", destination: "Netto", subscription: "Findes ikke" };
      expect(() => createFakeFirefly({ ...exampleSeed, transactions: [{ splits: [split] }] })).toThrow(
        /subscription/,
      );
    });
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
