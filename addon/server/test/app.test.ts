import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { VERSION } from "../src/version";

let webDir: string;

beforeAll(() => {
  webDir = mkdtempSync(join(tmpdir(), "ha-spending-web-"));
  writeFileSync(join(webDir, "index.html"), "<p>page</p>");
  mkdirSync(join(webDir, "web"));
  writeFileSync(join(webDir, "web", "a.js"), "export {};");
});

afterAll(() => {
  rmSync(webDir, { recursive: true, force: true });
});

const from = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });
const ingress = from("::ffff:172.30.32.2");

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

  it("has no route that writes", async () => {
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
});
