import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HiddenShops, HiddenShopsError } from "@ha-spending/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createHiddenShopsStore } from "../src/hidden-shops";

const from = (address: string) => ({ incoming: { socket: { remoteAddress: address } } });
const ingress = from("::ffff:172.30.32.2");
const ROUTE = "/api/hidden-shops";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ha-spending-hidden-"));
  path = join(dir, "hidden-shops.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function setup(at = path) {
  const log = vi.fn();
  const app = createApp({
    webDir: "/nowhere",
    dev: false,
    loadData: () => Promise.reject(new Error("not used")),
    log,
    hiddenShops: createHiddenShopsStore(at, log),
  });
  const get = () => app.request(ROUTE, {}, ingress);
  const post = (body: string, contentType: string | null = "application/json") =>
    app.request(
      ROUTE,
      contentType === null
        ? // A string body would get text/plain from fetch; bytes get no type at all.
          { method: "POST", body: new TextEncoder().encode(body) }
        : { method: "POST", body, headers: { "Content-Type": contentType } },
      ingress,
    );
  const change = (shop: string, hidden: boolean) => post(JSON.stringify({ shop, hidden }));
  const logged = () => log.mock.calls.map((call) => String(call[0]));
  return { app, get, post, change, log, logged };
}

const shopsOf = async (res: Response) => ((await res.json()) as HiddenShops).shops;
const errorOf = async (res: Response) => ((await res.json()) as HiddenShopsError).error;
const onDisk = () => JSON.parse(readFileSync(path, "utf8")) as unknown;

describe("/api/hidden-shops", () => {
  it("GET with no file is empty and not cached", async () => {
    const res = await setup().get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ shops: [] });
  });

  it("hiding answers the sorted list, and twice is the same", async () => {
    const { change } = setup();
    expect(await shopsOf(await change("Udlejer", true))).toEqual(["Udlejer"]);
    expect(await shopsOf(await change("Kommunen", true))).toEqual(["Kommunen", "Udlejer"]);
    const again = await change("Udlejer", true);
    expect(again.status).toBe(200);
    expect(again.headers.get("cache-control")).toBe("no-store");
    expect(await shopsOf(again)).toEqual(["Kommunen", "Udlejer"]);
    expect(onDisk()).toEqual({ shops: ["Kommunen", "Udlejer"] });
  });

  it("showing again removes it, and showing a shown shop changes nothing", async () => {
    const { change, get } = setup();
    await change("Udlejer", true);
    await change("Kommunen", true);
    expect(await shopsOf(await change("Udlejer", false))).toEqual(["Kommunen"]);
    expect(await shopsOf(await change("Udlejer", false))).toEqual(["Kommunen"]);
    expect(await shopsOf(await change("Aldrig Skjult", false))).toEqual(["Kommunen"]);
    expect(await shopsOf(await get())).toEqual(["Kommunen"]);
    expect(onDisk()).toEqual({ shops: ["Kommunen"] });
  });

  it("the list survives a new app on the same path, and a hand edit shows on the next GET", async () => {
    await setup().change("Udlejer", true);
    const { get } = setup();
    expect(await shopsOf(await get())).toEqual(["Udlejer"]);
    writeFileSync(path, JSON.stringify({ shops: ["Kommunen", "Udlejer"] }));
    expect(await shopsOf(await get())).toEqual(["Kommunen", "Udlejer"]);
  });

  it("odd names round-trip", async () => {
    const names = ["H&M / COS", "100% Kaffe", "..", "Æblehaven Ø", "  Netto  "];
    const { change, get } = setup();
    for (const name of names) expect((await change(name, true)).status).toBe(200);
    const shops = await shopsOf(await get());
    expect([...shops].sort()).toEqual([...names].sort());
    for (const name of names) expect(await shopsOf(await change(name, false))).not.toContain(name);
    expect(await shopsOf(await get())).toEqual([]);
  });

  it("two hides at once both end in the file", async () => {
    const { change, get } = setup();
    const answers = await Promise.all([change("Udlejer", true), change("Kommunen", true)]);
    expect(answers.map((res) => res.status)).toEqual([200, 200]);
    expect(await shopsOf(await get())).toEqual(["Kommunen", "Udlejer"]);
    expect(onDisk()).toEqual({ shops: ["Kommunen", "Udlejer"] });
  });

  it("a wrong content type is 415", async () => {
    const { post, get } = setup();
    const body = JSON.stringify({ shop: "Udlejer", hidden: true });
    for (const type of ["text/plain", null]) {
      const res = await post(body, type);
      expect(res.status).toBe(415);
      expect(await errorOf(res)).toBe("unsupported");
    }
    expect(await shopsOf(await get())).toEqual([]);
    const accepted = await post(body, "application/json; charset=utf-8");
    expect(accepted.status).toBe(200);
    expect(await shopsOf(accepted)).toEqual(["Udlejer"]);
  });

  it("a bad body is 400", async () => {
    const { post, get } = setup();
    const bodies = [
      JSON.stringify({ shop: "", hidden: true }),
      JSON.stringify({ shop: "x".repeat(201), hidden: true }),
      JSON.stringify({ shop: "a\nb", hidden: true }),
      JSON.stringify({ shop: "a\u007fb", hidden: true }),
      JSON.stringify({ shop: "Udlejer" }),
      JSON.stringify({ shop: "Udlejer", hidden: "yes" }),
      JSON.stringify({ shop: "Udlejer", hidden: true, extra: 1 }),
      JSON.stringify([{ shop: "Udlejer", hidden: true }]),
      `${JSON.stringify({ shop: "Udlejer", hidden: true })}${" ".repeat(1024)}`,
      "not json",
    ];
    for (const body of bodies) {
      const res = await post(body);
      expect(res.status, body.slice(0, 40)).toBe(400);
      expect(await errorOf(res)).toBe("bad-request");
    }
    expect(await shopsOf(await get())).toEqual([]);
  });

  it("accepts a name of exactly 200 characters", async () => {
    const name = "x".repeat(200);
    expect(await shopsOf(await setup().change(name, true))).toEqual([name]);
  });

  it("the 501st is 409", async () => {
    const shops = Array.from({ length: 500 }, (_, i) => `Butik ${String(i).padStart(3, "0")}`);
    writeFileSync(path, JSON.stringify({ shops }));
    const { change } = setup();
    const full = await change("Ny Butik", true);
    expect(full.status).toBe(409);
    expect(await errorOf(full)).toBe("full");
    expect(onDisk()).toEqual({ shops });
    const known = await change("Butik 042", true);
    expect(known.status).toBe(200);
    expect(await shopsOf(known)).toHaveLength(500);
  });

  it("an unreadable file reads as empty, is logged, and the next hide replaces it", async () => {
    writeFileSync(path, "{");
    const { get, change, logged } = setup();
    expect(await shopsOf(await get())).toEqual([]);
    expect(logged()).toContain("hidden shops: unreadable, treated as empty");
    expect(await shopsOf(await change("x", true))).toEqual(["x"]);
    expect(onDisk()).toEqual({ shops: ["x"] });

    writeFileSync(path, JSON.stringify(["x"]));
    expect(await shopsOf(await get())).toEqual([]);
    expect(await shopsOf(await change("y", true))).toEqual(["y"]);
    expect(onDisk()).toEqual({ shops: ["y"] });
  });

  it("a log line names the route and the code, never the shop", async () => {
    const shops = Array.from({ length: 500 }, (_, i) => `Butik ${i}`);
    writeFileSync(path, JSON.stringify({ shops }));
    const { change, logged } = setup();
    expect((await change("Hemmelig Butik", true)).status).toBe(409);
    expect(logged()).toContain("POST /api/hidden-shops: full");
    expect(logged().some((line) => line.includes("Hemmelig"))).toBe(false);
  });

  it("a failed write is 500", async () => {
    const { change, logged } = setup(join(dir, "missing", "hidden-shops.json"));
    const res = await change("Hemmelig Butik", true);
    expect(res.status).toBe(500);
    expect(await errorOf(res)).toBe("internal");
    expect(logged()).toContain("POST /api/hidden-shops: internal");
    expect(logged().some((line) => line.includes("Hemmelig"))).toBe(false);
  });

  it("a failed read is 500", async () => {
    mkdirSync(path);
    const { get, change, logged } = setup();
    const read = await get();
    expect(read.status).toBe(500);
    expect(await errorOf(read)).toBe("internal");
    expect(logged()).toContain("GET /api/hidden-shops: internal");
    expect((await change("Udlejer", true)).status).toBe(500);
  });

  it("a peer that is not ingress gets 403", async () => {
    const { app } = setup();
    const outsider = from("192.0.2.10");
    expect((await app.request(ROUTE, {}, outsider)).status).toBe(403);
    const body = JSON.stringify({ shop: "Udlejer", hidden: true });
    const posted = await app.request(
      ROUTE,
      { method: "POST", body, headers: { "Content-Type": "application/json" } },
      outsider,
    );
    expect(posted.status).toBe(403);
    expect(() => readFileSync(path)).toThrow();
  });

  it("PUT and DELETE are 404", async () => {
    const { app } = setup();
    for (const method of ["PUT", "DELETE"]) {
      expect((await app.request(ROUTE, { method }, ingress)).status).toBe(404);
    }
  });
});
