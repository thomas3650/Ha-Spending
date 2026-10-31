import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { createFakeFirefly, exampleSeed } from "@ha-spending/dev";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient } from "../src/firefly/client";
import { createSorterApp, PROTOCOL_VERSIONS } from "../src/sorter/http";
import { createSorterTools } from "../src/sorter/tools";
import { VERSION } from "../src/version";

const KEY = "made-up-sorter-key-made-up-sorter-key";

function sorter() {
  const fake = createFakeFirefly(exampleSeed);
  const client = createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
  const log = vi.fn();
  const tools = createSorterTools(
    client,
    {
      mainGroupRuleGroup: "Hovedgrupper",
      excludedMainGroups: ["Penge ind og ud"],
      inboxCategory: "Til sortering",
      pageSize: 500,
      timeoutMs: 1000,
    },
    log,
  );
  return { fake, log, app: createSorterApp({ key: KEY, tools, log }) };
}

function post(body: unknown, headers: Record<string, string> = { Authorization: `Bearer ${KEY}` }): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

const rpc = (method: string, params?: unknown, id: string | number = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("the sorter's endpoint", () => {
  it.each([
    ["no key", {}],
    ["a wrong key", { Authorization: "Bearer made-up-wrong-key-made-up-wrong-key" }],
    ["the key one character short", { Authorization: `Bearer ${KEY.slice(0, -1)}` }],
    ["the key as a basic login", { Authorization: `Basic ${KEY}` }],
  ])("answers 401 to %s, and logs no key", async (_, headers) => {
    const { app, fake, log } = sorter();
    const res = await app.request("/mcp", post(rpc("tools/call", { name: "start", arguments: {} }), headers));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(fake.requests).toEqual([]);
    expect(log).toHaveBeenCalledWith("sorter: unauthorized");
    for (const line of log.mock.calls.flat().map(String)) expect(line).not.toContain("made-up");
  });

  it("answers 401 to a GET without the key", async () => {
    expect((await sorter().app.request("/mcp")).status).toBe(401);
  });

  it("initializes, echoing a protocol version it knows", async () => {
    const { app } = sorter();
    const res = await app.request("/mcp", post(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "made-up", version: "1" } })));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "ha-spending-sorter", version: VERSION },
      },
    });
  });

  it("answers its newest protocol version to one it does not know", async () => {
    const res = await sorter().app.request("/mcp", post(rpc("initialize", { protocolVersion: "1999-01-01" }, "a")));
    expect(await res.json()).toMatchObject({ id: "a", result: { protocolVersion: PROTOCOL_VERSIONS[0] } });
  });

  it("takes a notification or a response with 202 and no body", async () => {
    const { app } = sorter();
    const note = await app.request("/mcp", post({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(note.status).toBe(202);
    expect(await note.text()).toBe("");
    const reply = await app.request("/mcp", post({ jsonrpc: "2.0", id: 7, result: {} }));
    expect(reply.status).toBe(202);
  });

  it("lists the two tools with their input schemas", async () => {
    const res = await sorter().app.request("/mcp", post(rpc("tools/list")));
    const { result } = (await res.json()) as {
      result: { tools: { name: string; description: string; inputSchema: { type: string; required: string[] } }[] };
    };
    expect(result.tools.map((t) => t.name)).toEqual(["start", "set_category"]);
    for (const tool of result.tools) {
      expect(tool.description).not.toBe("");
      expect(tool.inputSchema.type).toBe("object");
    }
    expect(result.tools[0].inputSchema.required).toEqual(["categories"]);
    expect(result.tools[1].inputSchema.required).toEqual(["assignments"]);
  });

  it("answers a ping", async () => {
    const res = await sorter().app.request("/mcp", post(rpc("ping")));
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("answers JSON-RPC errors to an unknown method, an unknown tool and a broken message", async () => {
    const { app, fake } = sorter();
    const error = async (body: unknown) => {
      const res = await app.request("/mcp", post(body));
      return { status: res.status, error: ((await res.json()) as { error: { code: number } }).error.code };
    };
    expect(await error(rpc("resources/list"))).toEqual({ status: 200, error: -32601 });
    expect(await error(rpc("tools/call", { name: "delete_all", arguments: {} }))).toEqual({ status: 200, error: -32602 });
    expect(await error("{not json")).toEqual({ status: 400, error: -32700 });
    expect(await error([rpc("ping")])).toEqual({ status: 400, error: -32600 });
    expect(await error({ jsonrpc: "1.0", id: 1, method: "ping" })).toEqual({ status: 400, error: -32600 });
    expect(fake.requests).toEqual([]);
  });

  it("answers 405 to a GET or a DELETE, and 404 elsewhere", async () => {
    const { app } = sorter();
    const auth = { headers: { Authorization: `Bearer ${KEY}` } };
    const get = await app.request("/mcp", auth);
    expect(get.status).toBe(405);
    expect(get.headers.get("Allow")).toBe("POST");
    expect((await app.request("/mcp", { ...auth, method: "DELETE" })).status).toBe(405);
    expect((await app.request("/api/data", auth)).status).toBe(404);
  });

  it("answers any peer that has the key over a real connection", async () => {
    const { app } = sorter();
    const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, post(rpc("ping")));
      expect(res.status).toBe(200);
      const without = await fetch(`http://127.0.0.1:${port}/mcp`, post(rpc("ping"), {}));
      expect(without.status).toBe(401);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
