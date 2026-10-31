import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { FireflyError } from "../firefly/client";
import { VERSION } from "../version";
import { type Tool, ToolFailure } from "./tools";

export const SORTER_PORT = 8100;

/** Newest first; a client asking for another version gets the newest. */
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const MAX_BODY_BYTES = 1024 * 1024;

type Id = string | number;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isId = (value: unknown): value is Id => typeof value === "string" || Number.isSafeInteger(value);

const digest = (value: string) => createHash("sha256").update(value).digest();

const rpcError = (id: Id | null, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

const toolResult = (value: unknown, isError: boolean) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

/**
 * The sorter's MCP endpoint: JSON-RPC over streamable HTTP, answered as plain JSON (D29). Every request needs the
 * key; the tools hold the rules on what may be written.
 */
export function createSorterApp(options: { key: string; tools: Tool[]; log?: (message: string) => void }): Hono {
  const app = new Hono();
  const log = options.log ?? ((message: string) => console.error(message));
  const expected = digest(options.key);

  app.use(async (c, next) => {
    // A browser sends an Origin; the sorter's client does not.
    if (c.req.header("Origin") !== undefined) return c.json({ error: "forbidden" }, 403);
    const given = /^Bearer (.+)$/i.exec(c.req.header("Authorization") ?? "")?.[1] ?? "";
    // Equal-length digests, so the comparison takes the same time whatever was sent.
    if (!timingSafeEqual(digest(given), expected)) {
      log("sorter: unauthorized");
      return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
    }
    await next();
  });

  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json(rpcError(null, -32600, "Too large"), 413) }));

  app.post("/mcp", async (c) => {
    let message: unknown;
    try {
      message = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, "Parse error"), 400);
    }
    if (!isRecord(message) || message.jsonrpc !== "2.0") return c.json(rpcError(null, -32600, "Invalid request"), 400);
    const { id, method, params } = message;
    if (typeof method !== "string") {
      if ("result" in message || "error" in message) return c.body(null, 202);
      return c.json(rpcError(isId(id) ? id : null, -32600, "Invalid request"), 400);
    }
    if (!("id" in message)) return c.body(null, 202);
    if (!isId(id)) return c.json(rpcError(null, -32600, "Invalid request"), 400);

    const answer = (result: unknown) => c.json({ jsonrpc: "2.0", id, result });
    switch (method) {
      case "initialize": {
        const asked = isRecord(params) ? params.protocolVersion : undefined;
        const protocolVersion =
          typeof asked === "string" && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
        return answer({
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "ha-spending-sorter", version: VERSION },
        });
      }
      case "ping":
        return answer({});
      case "tools/list":
        return answer({
          tools: options.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        });
      case "tools/call": {
        const name = isRecord(params) ? params.name : undefined;
        const tool = options.tools.find((t) => t.name === name);
        if (tool === undefined) return c.json(rpcError(id, -32602, "Unknown tool"));
        try {
          return answer(toolResult(await tool.call(isRecord(params) ? (params.arguments ?? {}) : {}), false));
        } catch (error) {
          // The code only: a message or a cause may carry a posting or the token.
          const code =
            error instanceof ToolFailure ? error.code : error instanceof FireflyError ? error.reason : "internal";
          log(`sorter: ${tool.name}: ${code}${code === "internal" && error instanceof Error ? ` (${error.name})` : ""}`);
          const detail = error instanceof ToolFailure ? error.detail : {};
          return answer(toolResult({ error: code, ...detail }, true));
        }
      }
      default:
        return c.json(rpcError(id, -32601, "Method not found"));
    }
  });
  app.all("/mcp", (c) => c.body(null, 405, { Allow: "POST" }));

  return app;
}
