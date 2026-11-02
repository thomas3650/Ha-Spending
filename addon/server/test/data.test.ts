import { createFakeFirefly, exampleSeed } from "@ha-spending/dev";
import type { SpendingData } from "@ha-spending/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, type DataLoader } from "../src/app";
import { createFireflyClient, type FetchLike } from "../src/firefly/client";
import { readSpendingData } from "../src/firefly/read";
import type { WireBill, WireGroup, WirePage } from "../src/firefly/wire";

const ingress = { incoming: { socket: { remoteAddress: "172.30.32.2" } } };
const R1 = "/api/data?start=2025-12-01&end=2026-07-31";

function loaderOver(token: string): DataLoader {
  const fake = createFakeFirefly(exampleSeed, { token: "fake-token" });
  const client = createFireflyClient({ baseUrl: "http://firefly.test", token, fetch: fake.fetch });
  const settings = {
    mainGroupRuleGroup: "Hovedgrupper",
    excludedMainGroups: ["Penge ind og ud"],
    fireflyLinkUrl: null,
    pageSize: 500,
    timeoutMs: 30_000,
  };
  return (range) => readSpendingData(client, settings, range, { today: "2026-10-30", warn: console.warn });
}

const CONSOLE = ["log", "info", "warn", "error", "debug"] as const;

function spyOnEverything() {
  const log = vi.fn();
  const spies = CONSOLE.map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
  const logged = () => [log, ...spies].flatMap((spy) => spy.mock.calls.flat()).map((arg) => String(arg));
  return { log, logged };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/api/data over the fake Firefly III", () => {
  it("serves the example dataset end to end", async () => {
    const app = createApp({ webDir: "/nowhere", dev: false, loadData: loaderOver("fake-token"), log: () => {} });
    const res = await app.request(R1, {}, ingress);
    expect(res.status).toBe(200);
    const data = (await res.json()) as SpendingData;
    expect(data.postings).toHaveLength(15);
    expect(data.postings.reduce((s, p) => s + p.amount, 0)).toBe(1199858);
  });

  it("never puts the token in an answer or a log line", async () => {
    const { log, logged } = spyOnEverything();
    const app = createApp({ webDir: "/nowhere", dev: false, loadData: loaderOver("zz-made-up-token-zz"), log });
    const res = await app.request(R1, {}, ingress);
    const body = await res.text();
    expect(res.status).toBe(502);
    expect(JSON.parse(body)).toEqual({ error: "refused" });
    expect(body).not.toContain("zz-made-up-token-zz");
    expect(log).toHaveBeenCalled();
    for (const line of logged()) expect(line).not.toContain("zz-made-up-token-zz");
  });

  it("logs no posting", async () => {
    const { log, logged } = spyOnEverything();
    const app = createApp({ webDir: "/nowhere", dev: false, loadData: loaderOver("fake-token"), log });
    expect((await app.request(R1, {}, ingress)).status).toBe(200);
    for (const line of logged()) {
      expect(line).not.toContain("Netto");
      expect(line).not.toContain("412");
    }
  });
});

describe("the bill links on /api/data's postings", () => {
  const settings = {
    mainGroupRuleGroup: "Hovedgrupper",
    excludedMainGroups: ["Penge ind og ud"],
    fireflyLinkUrl: null,
    pageSize: 500,
    timeoutMs: 30_000,
  };
  async function postings(wrap: (fetch: FetchLike) => FetchLike = (f) => f) {
    const fake = createFakeFirefly(exampleSeed, { token: "fake-token" });
    const client = createFireflyClient({ baseUrl: "http://firefly.test", token: "fake-token", fetch: wrap(fake.fetch) });
    const app = createApp({
      webDir: "/nowhere",
      dev: false,
      loadData: (r) => readSpendingData(client, settings, r, { today: "2026-10-30", warn: () => {} }),
      log: () => {},
    });
    const res = await app.request(R1, {}, ingress);
    expect(res.status).toBe(200);
    return ((await res.json()) as SpendingData).postings;
  }

  const named = (list: SpendingData["postings"], text: string) => list.find((p) => p.text === text)!;

  it("marks a posting linked to a bill with its name and object group", async () => {
    const list = await postings();
    expect(named(list, "Husleje januar").subscription).toEqual({ name: "Husleje", objectGroup: "Faste udgifter" });
  });

  it("marks a posting of an inactive bill and of an ended one", async () => {
    const list = await postings();
    expect(named(list, "Avis april").subscription).toEqual({ name: "Avis", objectGroup: "Faste udgifter" });
    expect(named(list, "Gammel forsikring marts").subscription).toEqual({
      name: "Gammel forsikring",
      objectGroup: "Faste udgifter",
    });
  });

  it("does not mark a posting of a bill with no object group", async () => {
    const list = await postings();
    expect(named(list, "Bilka mad").subscription).toBeNull();
  });

  it("does not mark an unlinked posting", async () => {
    const list = await postings();
    expect(named(list, "Kiosk").subscription).toBeNull();
  });

  it("marks a refund linked to a bill", async () => {
    const bills = async (fetch: FetchLike) => {
      const res = await fetch("http://firefly.test/api/v1/bills?limit=100", {
        headers: { Authorization: "Bearer fake-token" },
      });
      return ((await res.json()) as WirePage<WireBill>).data;
    };
    const linkRefund: (fetch: FetchLike) => FetchLike = (fetch) => async (input, init) => {
      const res = await fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname !== "/api/v1/transactions" || !res.ok) return res;
      const husleje = (await bills(fetch)).find((b) => b.attributes.name === "Husleje")!.id;
      const page = (await res.json()) as WirePage<WireGroup>;
      for (const split of page.data.flatMap((g) => g.attributes.transactions)) {
        if (split.description === "Returvare Netto") split.bill_id = husleje;
      }
      return new Response(JSON.stringify(page), { status: res.status, headers: res.headers });
    };
    const list = await postings(linkRefund);
    expect(named(list, "Returvare Netto")).toMatchObject({
      kind: "refund",
      subscription: { name: "Husleje", objectGroup: "Faste udgifter" },
    });
  });
});
