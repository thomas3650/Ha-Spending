import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeFirefly, exampleSeed, type FakeFirefly } from "@ha-spending/dev";
import type { SpendingData } from "@ha-spending/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createFireflyClient, type FetchLike, type FireflyClient } from "../src/firefly/client";
import { readSpendingData } from "../src/firefly/read";
import { keepSubscriptions, type RawSubscription, readSubscriptions, subscriptionLinks } from "../src/firefly/subscriptions";
import type { WireBill, WirePaidDate, WireSplit } from "../src/firefly/wire";
import { createHiddenShopsStore } from "../src/hidden-shops";

const ingress = { incoming: { socket: { remoteAddress: "172.30.32.2" } } };

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ha-spending-hidden-"));
});
afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});
const hiddenShops = () => createHiddenShopsStore(join(dataDir, "hidden-shops.json"), () => {});

const R1 = "/api/data?start=2025-12-01&end=2026-07-31";
const today = "2026-10-30";
const settings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 5,
  timeoutMs: 30_000,
};

type Wrap = (fetch: FetchLike) => FetchLike;

function setup(wrap: Wrap = (f) => f, seed: typeof exampleSeed = exampleSeed) {
  const fake = createFakeFirefly(seed, { token: "fake-token" });
  const client = createFireflyClient({ baseUrl: "http://firefly.test", token: "fake-token", fetch: wrap(fake.fetch) });
  const warn = vi.fn();
  const app = createApp({
    webDir: "/nowhere",
    dev: false,
    loadData: (range) => readSpendingData(client, settings, range, { today, warn }),
    log: () => {},
    hiddenShops: hiddenShops(),
  });
  return { fake, app, warn };
}

async function answer(wrap?: Wrap, seed?: typeof exampleSeed) {
  const { app, warn } = setup(wrap, seed);
  const res = await app.request(R1, {}, ingress);
  expect(res.status).toBe(200);
  return { data: (await res.json()) as SpendingData, warn };
}

async function billsOf(fake: FakeFirefly): Promise<WireBill[]> {
  const res = await fake.fetch("http://firefly.test/api/v1/bills?start=2024-01-01&end=2026-10-30&limit=100", {
    headers: { Authorization: "Bearer fake-token" },
  });
  return ((await res.json()) as { data: WireBill[] }).data;
}

async function billNamed(name: string): Promise<WireBill> {
  return (await billsOf(createFakeFirefly(exampleSeed))).find((b) => b.attributes.name === name)!;
}

const GROUP_READ = /\/api\/v1\/transactions\/[0-9]+$/;
const pathOf = (input: string | URL | Request) => new URL(input instanceof Request ? input.url : input).pathname;
const failing = (test: (path: string) => boolean, status: number): Wrap => (fetch) => (input, init) =>
  test(pathOf(input)) ? Promise.resolve(new Response("{}", { status })) : fetch(input, init);

describe("/api/data's subscriptions over the fake Firefly III", () => {
  it("keeps the subscriptions §3 keeps, by name", async () => {
    const { data } = await answer();
    expect(data.subscriptions.map((s) => s.name)).toEqual([
      "Fitness",
      "Gammel forsikring",
      "Gavekasse",
      "Husleje",
      "Indboforsikring",
      "Netflix",
      "Tandforsikring",
    ]);
  });

  it("reads Husleje's fields and its last payment", async () => {
    const { data } = await answer();
    const kontoA = data.accounts.find((a) => a.name === "Konto A")!.id;
    expect(data.subscriptions.find((s) => s.name === "Husleje")).toEqual({
      id: (await billNamed("Husleje")).id,
      name: "Husleje",
      repeat: "monthly",
      skip: 0,
      start: "2025-01-31",
      end: null,
      amountMin: 800000,
      amountMax: 800000,
      objectGroup: "Faste udgifter",
      lastPayment: { date: "2025-12-30", amount: 800000, category: "Husleje", account: kontoA },
    });
  });

  it("leaves out a bill with no object group", async () => {
    const { data } = await answer();
    expect(data.subscriptions.map((s) => s.name)).not.toContain("Bilka");
  });

  it("gives a bill its object group", async () => {
    const { data } = await answer();
    expect(data.subscriptions.find((s) => s.name === "Netflix")!.objectGroup).toBe("Abonnementer");
  });

  it("reads no last payment for a bill with no object group", async () => {
    const read: string[] = [];
    const { app, fake } = setup((fetch) => (input, init) => {
      read.push(pathOf(input));
      return fetch(input, init);
    });
    expect((await app.request(R1, {}, ingress)).status).toBe(200);
    const bills = await billsOf(fake);
    const groupOf = (name: string) =>
      bills.find((b) => b.attributes.name === name)!.attributes.paid_dates.map(
        (p) => `/api/v1/transactions/${p.transaction_group_id}`,
      );
    const groups = groupOf("Bilka");
    expect(groups.length).toBeGreaterThan(0);
    // Gavekasse is paid by the other split of Bilka's split group, so that group is read once, for Gavekasse.
    const shared = groupOf("Gavekasse");
    for (const group of groups) {
      expect(read.filter((r) => r === group)).toHaveLength(shared.includes(group) ? 1 : 0);
    }
  });

  it("takes the category and amount of the linked split in a split group", async () => {
    const seed = {
      ...exampleSeed,
      subscriptions: exampleSeed.subscriptions?.map((s) =>
        s.name === "Bilka" ? { ...s, objectGroup: "Faste udgifter" } : s,
      ),
    };
    const { data } = await answer(undefined, seed);
    const kontoA = data.accounts.find((a) => a.name === "Konto A")!.id;
    expect(data.subscriptions.find((s) => s.name === "Bilka")!.lastPayment).toMatchObject({
      date: "2026-01-10",
      amount: 20000,
      category: "Dagligvarer",
      account: kontoA,
    });
  });

  it("takes the last payment on or before today, keeps one with no payment and one ending today", async () => {
    const { data } = await answer();
    const named = (name: string) => data.subscriptions.find((s) => s.name === name);
    expect(named("Indboforsikring")!.lastPayment!.date).toBe("2026-09-15");
    expect(named("Tandforsikring")!.lastPayment).toBeNull();
    expect(named("Fitness")).toMatchObject({ end: "2026-10-30", lastPayment: null });
  });

  it("leaves out inactive, saved and liability-paid subscriptions", async () => {
    const { data } = await answer();
    const names = data.subscriptions.map((s) => s.name);
    for (const name of ["Opsparingsaftale", "Billån", "Avis"]) expect(names).not.toContain(name);
  });

  it("leaves out a bill that ended before a range that starts later", async () => {
    const { app } = setup();
    const res = await app.request("/api/data?start=2026-10-30&end=2026-10-30", {}, ingress);
    expect(res.status).toBe(200);
    const names = ((await res.json()) as SpendingData).subscriptions.map((s) => s.name);
    expect(names).not.toContain("Gammel forsikring");
    expect(names).toContain("Fitness");
  });

  it("leaves out a gap over 24 months and warns with the id, not the name", async () => {
    const { data, warn } = await answer();
    expect(data.subscriptions.map((s) => s.name)).not.toContain("Hver tredje år");
    const id = (await billNamed("Hver tredje år")).id;
    const lines = warn.mock.calls.map((call) => String(call[0]));
    expect(lines.filter((line) => line.includes(id))).toHaveLength(1);
    for (const line of lines) expect(line).not.toContain("Hver tredje år");
  });

  it("asks the bills for 760 days up to today, on every page", async () => {
    const asked: URL[] = [];
    await answer((fetch) => (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === "/api/v1/bills") asked.push(url);
      return fetch(input, init);
    });
    expect(asked).toHaveLength(3);
    for (const url of asked) {
      expect(url.searchParams.get("start")).toBe("2024-09-30");
      expect(url.searchParams.get("end")).toBe("2026-10-30");
    }
  });

  it("answers the error code when the bills read fails", async () => {
    const { app } = setup(failing((path) => path === "/api/v1/bills", 500));
    const res = await app.request(R1, {}, ingress);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unreachable" });
  });

  it("answers the error code when one group read fails", async () => {
    const group = (await billNamed("Husleje")).attributes.paid_dates[0].transaction_group_id;
    const { app } = setup(failing((path) => path === `/api/v1/transactions/${group}`, 404));
    const res = await app.request(R1, {}, ingress);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unreachable" });
  });

  it("reads one group per last payment, at most 5 at a time", async () => {
    let open = 0;
    let most = 0;
    const read: string[] = [];
    const { app, fake } = setup((fetch) => async (input, init) => {
      const path = pathOf(input);
      if (!GROUP_READ.test(path)) return fetch(input, init);
      read.push(path);
      open += 1;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 20));
      open -= 1;
      return fetch(input, init);
    });
    expect((await app.request(R1, {}, ingress)).status).toBe(200);
    const grouped = (await billsOf(fake)).filter((b) => (b.attributes.object_group_title ?? "").trim() !== "");
    const paid = grouped.flatMap((b) => {
      const dates = b.attributes.paid_dates;
      return dates.length === 0 ? [] : [`/api/v1/transactions/${dates[dates.length - 1].transaction_group_id}`];
    });
    expect(paid).toHaveLength(8);
    expect(read.sort()).toEqual(paid.sort());
    expect(most).toBe(5);
  });
});

function bill(attributes: Partial<WireBill["attributes"]> = {}): WireBill {
  return {
    id: "71",
    attributes: {
      name: "Made-up streaming",
      amount_min: "10.00",
      amount_max: "20.00",
      date: "2026-01-05T00:00:00+01:00",
      end_date: null,
      repeat_freq: "monthly",
      skip: 0,
      active: true,
      paid_dates: [],
      object_group_title: "Made-up group",
      ...attributes,
    },
  };
}

function paidDate(date: string, group: string, journal: string): WirePaidDate {
  return {
    transaction_group_id: group,
    transaction_journal_id: journal,
    date: `${date}T00:00:00+01:00`,
    amount: "15.00",
  };
}

function split(journal: string, category: string | null): WireSplit {
  return {
    transaction_journal_id: journal,
    type: "withdrawal",
    date: "2026-10-05T00:00:00+01:00",
    amount: "15.00",
    currency_code: "DKK",
    foreign_amount: null,
    foreign_currency_code: null,
    description: "Made-up payment",
    source_id: "3",
    source_name: "Made-up account",
    source_type: "Asset account",
    destination_id: "9",
    destination_name: "Made-up shop",
    destination_type: "Expense account",
    category_id: null,
    category_name: category,
    tags: [],
    notes: null,
    bill_id: null,
  };
}

describe("readSubscriptions", () => {
  it("takes the latest payment on or before today, whatever the order", async () => {
    const paid = [
      paidDate("2026-05-05", "201", "301"),
      paidDate("2026-10-05", "202", "302"),
      paidDate("2026-11-05", "203", "303"),
    ];
    const asked: string[] = [];
    const client: FireflyClient = {
      get: (path) => {
        asked.push(path);
        if (path === "bills") return Promise.resolve({ data: [bill({ paid_dates: paid })] });
        if (path === "transactions/202") {
          return Promise.resolve({ data: { id: "202", attributes: { group_title: null,
            transactions: [split("399", "Other"), split("302", "Streaming")] } } });
        }
        return Promise.reject(new Error(`unexpected read ${path}`));
      },
      put: () => Promise.reject(new Error("no write")),
      post: () => Promise.reject(new Error("no write")),
    };
    const { kept: [raw], bills } = await readSubscriptions(client, { pageSize: 50 }, today);
    expect(bills).toHaveLength(1);
    expect(raw.lastPaid).toEqual(paid[1]);
    expect(raw.split).toMatchObject({ transaction_journal_id: "302", category_name: "Streaming" });
    expect(asked).toEqual(["bills", "transactions/202"]);
  });
});

describe("readSubscriptions and object groups", () => {
  it("leaves out a bill whose object group is only spaces", async () => {
    const client: FireflyClient = {
      get: (path) =>
        path === "bills"
          ? Promise.resolve({
              data: [bill({ object_group_title: "  ", paid_dates: [paidDate("2026-10-05", "201", "301")] })],
            })
          : Promise.reject(new Error(`unexpected read ${path}`)),
      put: () => Promise.reject(new Error("no write")),
      post: () => Promise.reject(new Error("no write")),
    };
    const { kept, bills } = await readSubscriptions(client, { pageSize: 50 }, today);
    expect(kept).toEqual([]);
    expect(bills).toHaveLength(1);
  });
});

describe("subscriptionLinks", () => {
  const bills = [
    { ...bill({ name: "Made-up rent", object_group_title: "Made-up fixed" }), id: "81" },
    { ...bill({ name: "Made-up shop", object_group_title: null }), id: "82" },
    { ...bill({ name: "Made-up blank", object_group_title: " " }), id: "83" },
  ];

  it("a posting linked to a bill with an object group carries the bill's id, name and object group", () => {
    expect(subscriptionLinks(bills)("81")).toEqual({ id: "81", name: "Made-up rent", objectGroup: "Made-up fixed" });
  });

  it("a posting whose bill has no object group carries null, as do an unknown id and a null id", () => {
    const linkOf = subscriptionLinks(bills);
    expect(linkOf("82")).toBeNull();
    expect(linkOf("83")).toBeNull();
    expect(linkOf("99")).toBeNull();
    expect(linkOf(null)).toBeNull();
  });
});

describe("keepSubscriptions", () => {
  const none = () => null;
  const rangeStart = "2026-01-01";
  const keep = (raw: RawSubscription[], warn: (message: string) => void = () => {}) =>
    keepSubscriptions(raw, none, new Set(), today, rangeStart, warn);
  const raw = (b: RawSubscription["bill"], lastPaid: RawSubscription["lastPaid"]): RawSubscription =>
    ({ bill: b, objectGroup: "Made-up group", lastPaid, split: null });

  it("keeps a bill that ended before today on or after the range's start", () => {
    for (const end of ["2026-05-31", "2026-01-01"]) {
      expect(keep([raw(bill({ end_date: `${end}T00:00:00+01:00` }), null)]).map((s) => s.end)).toEqual([end]);
    }
  });

  it("leaves out a bill that ended before the range's start", () => {
    expect(keep([raw(bill({ end_date: "2025-12-31T00:00:00+01:00" }), null)])).toEqual([]);
  });

  it("leaves out an inactive bill, with or without an end date", () => {
    expect(keep([raw(bill({ active: false }), null)])).toEqual([]);
    expect(keep([raw(bill({ active: false, end_date: "2026-05-31T00:00:00+01:00" }), null)])).toEqual([]);
  });

  it("ignores a last payment after today", () => {
    const later = paidDate("2026-11-05", "203", "303");
    const [kept] = keep([raw(bill({ paid_dates: [later] }), later)]);
    expect(kept.lastPayment).toBeNull();
  });

  it("leaves out an unknown repeat and warns with the id, not the name", () => {
    const warn = vi.fn();
    expect(keep([raw(bill({ repeat_freq: "daily" }), null)], warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("71");
    expect(warn.mock.calls[0][0]).not.toContain("Made-up streaming");
  });

  it("fails as unreachable when the payment's split is not in its group", () => {
    const paid = paidDate("2026-10-05", "202", "302");
    expect(() => keep([raw(bill({ paid_dates: [paid] }), paid)])).toThrow(
      expect.objectContaining({ reason: "unreachable" }),
    );
  });
});
