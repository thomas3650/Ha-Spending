import { exampleSeed, seedFirefly } from "@ha-spending/dev";
import { classify, parts, type SpendingData } from "@ha-spending/shared";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createFireflyClient, type FetchLike, type FireflyClient, FireflyError } from "../src/firefly/client";
import { type ReadSettings, readSpendingData, readVersion } from "../src/firefly/read";
import type { WireAccount, WirePage } from "../src/firefly/wire";

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
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("Streaming");
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

  it("maps a refused token and an unreachable Firefly III", async () => {
    const refused = readVersion(createFireflyClient({ baseUrl: url, token: "wrong" }));
    await expect(refused).rejects.toBeInstanceOf(FireflyError);
    await expect(refused).rejects.toMatchObject({ reason: "refused" });
    const away = readVersion(createFireflyClient({ baseUrl: "http://127.0.0.1:1", token }));
    await expect(away).rejects.toMatchObject({ reason: "unreachable" });
  });
});
