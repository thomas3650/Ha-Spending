import { createFakeFirefly, exampleSeed } from "@ha-spending/dev";
import type { SpendingData } from "@ha-spending/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, type DataLoader } from "../src/app";
import { createFireflyClient } from "../src/firefly/client";
import { readSpendingData } from "../src/firefly/read";

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
    expect(data.postings).toHaveLength(13);
    expect(data.postings.reduce((s, p) => s + p.amount, 0)).toBe(1059958);
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
