import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import type { LeftOverData, SpendingData } from "@ha-spending/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp as createAppWith, type DataLoader, type LeftOverLoader } from "../src/app";
import { FireflyError } from "../src/firefly/client";
import { createHiddenShopsStore } from "../src/hidden-shops";
import { VERSION } from "../src/version";

let webDir: string;
let dataDir: string;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ha-spending-hidden-"));
  webDir = mkdtempSync(join(tmpdir(), "ha-spending-web-"));
  writeFileSync(join(webDir, "index.html"), "<p>page</p>");
  mkdirSync(join(webDir, "web"));
  writeFileSync(join(webDir, "web", "a.js"), "export {};");
});

afterAll(() => {
  rmSync(webDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

const from = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });
const ingress = from("::ffff:172.30.32.2");

const D: SpendingData = {
  range: { start: "2026-01-01", end: "2026-01-31" },
  today: "2026-01-15",
  earliestPostingDate: "2025-06-01",
  postings: [
    {
      id: "1",
      groupId: "1",
      date: "2026-01-10",
      text: "Made-up shop",
      account: "a1",
      category: "Food",
      kind: "spending",
      shop: "Made-up shop",
      amount: 12345,
      subscription: null,
    },
  ],
  accounts: [{ id: "a1", name: "Account A" }],
  categories: [{ name: "Food", mainGroup: "Home" }],
  mainGroups: ["Home"],
  mainGroupsFound: true,
  fireflyLinkUrl: null,
  subscriptions: [],
  leftOver: false,
};

const unused: DataLoader = () => Promise.reject(new Error("not used"));

const L: LeftOverData = {
  range: { start: "2026-01-01", end: "2026-01-31" },
  today: "2026-01-15",
  hasSavings: false,
  hasCredit: false,
  months: [
    { month: "2026-01", paidIn: 700000, back: 0, members: [{ name: "Anna", paidIn: 700000, back: 0 }],
      spending: 600000, savings: 0, credit: 0, other: 0, change: 100000 },
  ],
};

function createApp(options: { webDir: string; dev: boolean; loadData?: DataLoader; loadLeftOver?: LeftOverLoader;
  log?: (message: string) => void }) {
  const hiddenShops = createHiddenShopsStore(join(dataDir, "hidden-shops.json"), () => {});
  return createAppWith({ loadData: unused, log: () => {}, hiddenShops, ...options });
}

describe("createApp", () => {
  it("answers the health from ingress", async () => {
    const res = await createApp({ webDir, dev: false }).request("/api/health", {}, ingress);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: VERSION });
  });

  it("refuses any other address with 403", async () => {
    const app = createApp({ webDir, dev: false });
    expect((await app.request("/api/health", {}, from("127.0.0.1"))).status).toBe(403);
    expect((await app.request("/", {}, from("127.0.0.1"))).status).toBe(403);
  });

  it("refuses a request with no peer address", async () => {
    const res = await createApp({ webDir, dev: false }).request("/api/health");
    expect(res.status).toBe(403);
  });

  it("lets every address in when dev is on", async () => {
    const res = await createApp({ webDir, dev: true }).request("/api/health", {}, from("127.0.0.1"));
    expect(res.status).toBe(200);
  });

  it("serves the page at / and its assets at /web/", async () => {
    const app = createApp({ webDir, dev: false });
    const page = await app.request("/", {}, ingress);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("page");
    expect((await app.request("/web/a.js", {}, ingress)).status).toBe(200);
  });

  it("makes the browser ask for the page again on every load", async () => {
    const res = await createApp({ webDir, dev: false }).request("/", {}, ingress);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("lets the browser keep a file under /web/ for good", async () => {
    const res = await createApp({ webDir, dev: false }).request("/web/a.js", {}, ingress);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("does not let the browser keep a missing file under /web/", async () => {
    const res = await createApp({ webDir, dev: false }).request("/web/missing.js", {}, ingress);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control") ?? "").not.toContain("immutable");
  });

  it("answers 404 to a POST on a read route and to an unknown route", async () => {
    const app = createApp({ webDir, dev: false });
    expect((await app.request("/api/health", { method: "POST" }, ingress)).status).toBe(404);
    expect((await app.request("/api/nope", {}, ingress)).status).toBe(404);
  });

  it("refuses a real connection from localhost", async () => {
    const app = createApp({ webDir, dev: false });
    const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it("answers the data for a range", async () => {
    const loadData = vi.fn(async () => D);
    const res = await createApp({ webDir, dev: false, loadData }).request(
      "/api/data?start=2026-01-01&end=2026-01-31",
      {},
      ingress,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(D);
    expect(loadData).toHaveBeenCalledWith({ start: "2026-01-01", end: "2026-01-31" });
  });

  it.each([
    "",
    "?start=2026-01-01",
    "?start=2026-02-30&end=2026-03-01",
    "?start=2026-1-1&end=2026-01-31",
    "?start=2026-02-01&end=2026-01-31",
  ])("refuses %s with 400", async (query) => {
    const loadData = vi.fn(async () => D);
    const res = await createApp({ webDir, dev: false, loadData }).request(`/api/data${query}`, {}, ingress);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad-request" });
    expect(loadData).not.toHaveBeenCalled();
  });

  it("maps the Firefly III errors", async () => {
    const answer = async (error: Error) => {
      const app = createApp({ webDir, dev: false, loadData: () => Promise.reject(error) });
      const res = await app.request("/api/data?start=2026-01-01&end=2026-01-31", {}, ingress);
      return { status: res.status, body: await res.json() };
    };
    expect(await answer(new FireflyError("refused"))).toEqual({ status: 502, body: { error: "refused" } });
    expect(await answer(new FireflyError("unreachable"))).toEqual({ status: 502, body: { error: "unreachable" } });
    expect(await answer(new Error())).toEqual({ status: 500, body: { error: "internal" } });
  });

  it("does not serve the sorter's endpoint on the ingress port", async () => {
    const app = createApp({ webDir, dev: false });
    const body = { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) };
    expect((await app.request("/mcp", body, from("192.0.2.10"))).status).toBe(403);
    expect((await app.request("/mcp", body, ingress)).status).toBe(404);
  });

  it("guards the data like every route", async () => {
    const loadData = vi.fn(async () => D);
    const app = createApp({ webDir, dev: false, loadData });
    const query = "/api/data?start=2026-01-01&end=2026-01-31";
    expect((await app.request(query, {}, from("127.0.0.1"))).status).toBe(403);
    expect((await app.request(query, { method: "POST" }, ingress)).status).toBe(404);
    expect(loadData).not.toHaveBeenCalled();
  });

  describe("/api/left-over", () => {
    const query = "/api/left-over?start=2026-01-01&end=2026-01-31";

    it("answers Til overs for a range", async () => {
      const loadLeftOver = vi.fn(async () => L);
      const res = await createApp({ webDir, dev: false, loadLeftOver }).request(query, {}, ingress);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(L);
      expect(loadLeftOver).toHaveBeenCalledWith({ start: "2026-01-01", end: "2026-01-31" });
    });

    it("is not found without a loader", async () => {
      expect((await createApp({ webDir, dev: false }).request(query, {}, ingress)).status).toBe(404);
    });

    it.each(["", "?start=2026-01-01", "?start=2026-02-30&end=2026-03-01", "?start=2026-02-01&end=2026-01-31"])(
      "refuses %s with 400",
      async (bad) => {
        const loadLeftOver = vi.fn(async () => L);
        const res = await createApp({ webDir, dev: false, loadLeftOver }).request(`/api/left-over${bad}`, {}, ingress);
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "bad-request" });
        expect(loadLeftOver).not.toHaveBeenCalled();
      },
    );

    it("maps the Firefly III errors", async () => {
      const answer = async (error: Error) => {
        const app = createApp({ webDir, dev: false, loadLeftOver: () => Promise.reject(error) });
        const res = await app.request(query, {}, ingress);
        return { status: res.status, body: await res.json() };
      };
      expect(await answer(new FireflyError("refused"))).toEqual({ status: 502, body: { error: "refused" } });
      expect(await answer(new Error())).toEqual({ status: 500, body: { error: "internal" } });
    });

    it("guards the route like every other", async () => {
      const loadLeftOver = vi.fn(async () => L);
      const app = createApp({ webDir, dev: false, loadLeftOver });
      expect((await app.request(query, {}, from("127.0.0.1"))).status).toBe(403);
      expect((await app.request(query, { method: "POST" }, ingress)).status).toBe(404);
      expect(loadLeftOver).not.toHaveBeenCalled();
    });

    it("logs no amount", async () => {
      const log = vi.fn();
      const error = new Error("amount 700000 of Anna");
      await createApp({ webDir, dev: false, loadLeftOver: () => Promise.reject(error), log }).request(query, {}, ingress);
      await createApp({ webDir, dev: false, loadLeftOver: vi.fn(async () => L), log }).request(
        "/api/left-over?start=x",
        {},
        ingress,
      );
      expect(log).toHaveBeenCalledTimes(2);
      for (const [line] of log.mock.calls) expect(String(line)).not.toMatch(/\d{4,}|Anna/);
    });
  });
});
