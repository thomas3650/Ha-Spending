import { createFakeFirefly, exampleSeed, generateSeed, type SeedSplit } from "@ha-spending/dev";
import { classify, fetchRange, parts, subscriptionStatus, within } from "@ha-spending/shared";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient } from "../src/firefly/client";
import { earliestPostingDate, type ReadSettings, readSpendingData, readVersion } from "../src/firefly/read";

const settings: ReadSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 5,
  timeoutMs: 1000,
};
const R1 = { start: "2025-12-01", end: "2026-07-31" };
const today = "2026-10-30";

function clientOf(fake = createFakeFirefly(exampleSeed)) {
  return createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
}

async function everyThirdYearId(): Promise<string> {
  const bills = (await clientOf().get("bills", { limit: "100" })) as { data: { id: string; attributes: { name: string } }[] };
  return bills.data.find((b) => b.attributes.name === "Hver tredje år")!.id;
}

const sum = (amounts: { amount: number }[]) => amounts.reduce((s, p) => s + p.amount, 0);

describe("readSpendingData", () => {
  it("reads the example dataset", async () => {
    const warn = vi.fn();
    const d = await readSpendingData(clientOf(), settings, R1, { today, warn });
    expect(d.range).toEqual(R1);
    expect(d.today).toBe(today);
    expect(d.fireflyLinkUrl).toBeNull();
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
    expect(warn.mock.calls[0][0]).toContain("Streaming");
  });

  it("lists the postings newest first", async () => {
    const d = await readSpendingData(clientOf(), settings, R1, { today, warn: () => {} });
    const dates = d.postings.map((p) => p.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("sums per main group and account as worked out by hand", async () => {
    const d = await readSpendingData(clientOf(), settings, R1, { today, warn: () => {} });
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

  it("adds an account Firefly III leaves out of the list", async () => {
    const client = clientOf(createFakeFirefly(exampleSeed, { hideInactiveAccounts: true }));
    const d = await readSpendingData(client, settings, R1, { today, warn: () => {} });
    expect(d.accounts.map((a) => a.name)).toEqual(["Konto A", "Konto B", "Konto C"]);
    const ids = new Set(d.accounts.map((a) => a.id));
    expect(d.postings.every((p) => ids.has(p.account))).toBe(true);
  });

  it("reads one month", async () => {
    const d = await readSpendingData(clientOf(), settings, { start: "2026-01-01", end: "2026-01-31" }, {
      today,
      warn: () => {},
    });
    expect(d.postings).toHaveLength(5);
    expect(sum(d.postings)).toBe(126900);
  });

  it("keeps the summer refund on its day", async () => {
    const d = await readSpendingData(clientOf(), settings, { start: "2026-07-01", end: "2026-07-31" }, {
      today,
      warn: () => {},
    });
    expect(d.postings).toHaveLength(1);
    expect(d.postings[0]).toMatchObject({
      date: "2026-07-01",
      kind: "refund",
      amount: -60000,
      category: "Brændstof",
    });
  });

  it("puts everything in Uden hovedgruppe without the rule group", async () => {
    const warn = vi.fn();
    const missing = { ...settings, mainGroupRuleGroup: "Findes ikke" };
    const d = await readSpendingData(clientOf(), missing, R1, { today, warn });
    expect(d.mainGroupsFound).toBe(false);
    expect(d.categories.length).toBeGreaterThan(0);
    expect(d.categories.every((c) => c.mainGroup === null)).toBe(true);
    expect(d.mainGroups).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(await everyThirdYearId());

    const january = await readSpendingData(clientOf(), missing, { start: "2026-01-01", end: "2026-01-31" }, {
      today,
      warn: () => {},
    });
    expect(sum(january.postings)).toBe(-273100);
  });

  it("answers an empty Firefly III", async () => {
    const client = clientOf(createFakeFirefly({ accounts: [], categories: [], ruleGroups: [], transactions: [] }));
    const d = await readSpendingData(client, settings, R1, { today, warn: () => {} });
    expect(d.postings).toEqual([]);
    expect(d.accounts).toEqual([]);
    expect(d.categories).toEqual([]);
    expect(d.earliestPostingDate).toBeNull();
    expect(d.mainGroupsFound).toBe(false);
  });

  it("drives every screen with the generated data", async () => {
    const client = clientOf(createFakeFirefly(generateSeed({ today, seed: 1 })));
    const year = { start: "2026-01-01", end: today };
    const d = await readSpendingData(client, settings, fetchRange(year, "month", today), { today, warn: () => {} });
    expect(d.mainGroups.length).toBeGreaterThan(8);
    expect(d.postings.some((p) => p.kind === "refund")).toBe(true);
    expect(d.postings.some((p) => p.category === null)).toBe(true);
    expect(d.postings.some((p) => p.shop !== null)).toBe(true);
    expect(d.postings.some((p) => p.shop === null)).toBe(true);
    expect(d.postings.some((p) => p.kind === "refund" && p.shop !== null)).toBe(true);
    expect(d.categories.some((c) => c.mainGroup === null)).toBe(true);
    expect(d.accounts).toHaveLength(3);
    expect(d.earliestPostingDate! >= "2025-08-01" && d.earliestPostingDate! <= "2025-08-15").toBe(true);
    const shown = parts(within(classify(d.postings, d.categories), year), { kind: "all" });
    expect(shown.filter((p) => p.amount > 0).length).toBeGreaterThan(8);
    const kinds = new Set(d.subscriptions.map((x) => subscriptionStatus(x, d.today).kind));
    expect([...kinds].sort()).toEqual(["expected", "notSeen", "paid", "risen"]);
  });
});

describe("earliestPostingDate", () => {
  const seedOf = (...splits: [SeedSplit["type"], string][]) =>
    createFakeFirefly({
      ...exampleSeed,
      transactions: splits.map(([type, date]) => ({
        splits: [{ type, date, amount: "1", description: date, source: type === "deposit" ? "Netto" : "Konto A",
          destination: { withdrawal: "Netto", deposit: "Konto A", transfer: "Konto B" }[type] }],
      })),
    });

  it("reads the first day with a withdrawal or a deposit, past an older transfer", async () => {
    expect(await earliestPostingDate(clientOf(), today)).toBe("2025-12-03");
  });

  it("takes the older of the oldest withdrawal and the oldest deposit", async () => {
    const fake = seedOf(["transfer", "2025-01-10"], ["deposit", "2025-03-01"], ["withdrawal", "2025-05-01"],
      ["withdrawal", "2025-06-01"]);
    expect(await earliestPostingDate(clientOf(fake), today)).toBe("2025-03-01");
    const withdrawalFirst = seedOf(["withdrawal", "2025-02-01"], ["deposit", "2025-03-01"], ["deposit", "2025-04-01"]);
    expect(await earliestPostingDate(clientOf(withdrawalFirst), today)).toBe("2025-02-01");
  });

  it("counts a withdrawal in an excluded main group", async () => {
    const fake = createFakeFirefly({
      ...exampleSeed,
      transactions: [
        ...exampleSeed.transactions,
        { splits: [{ type: "withdrawal", date: "2025-06-01", amount: "1", description: "Gammel opsparing",
          source: "Konto A", destination: "Opsparingskonto", category: "Opsparing" }] },
      ],
    });
    const d = await readSpendingData(clientOf(fake), settings, R1, { today, warn: () => {} });
    expect(d.earliestPostingDate).toBe("2025-06-01");
  });

  it("answers null with only transfers", async () => {
    expect(await earliestPostingDate(clientOf(seedOf(["transfer", "2025-01-10"])), today)).toBeNull();
  });

  it("takes two GETs per type, or one when there is at most one page", async () => {
    const many = createFakeFirefly(exampleSeed);
    await earliestPostingDate(clientOf(many), today);
    expect(many.requests).toHaveLength(4);
    const few = seedOf(["withdrawal", "2025-02-01"]);
    await earliestPostingDate(clientOf(few), today);
    expect(few.requests).toHaveLength(2);
  });
});

describe("readVersion", () => {
  it("reads the version", async () => {
    expect(await readVersion(clientOf())).toBe("6.7.9");
  });

  it("times out a slow Firefly III", async () => {
    const fake = createFakeFirefly(exampleSeed);
    fake.fault = "slow";
    const started = Date.now();
    await expect(readVersion(clientOf(fake), AbortSignal.timeout(50))).rejects.toMatchObject({ reason: "unreachable" });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
