import type { Context } from "hono";
import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import { type DataError, type DataErrorCode, type Health, isDate, type Period, type SpendingData } from "@ha-spending/shared";
import { FireflyError } from "./firefly/client";
import { isIngress } from "./ingress";
import { VERSION } from "./version";

function peerAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    // A request with no Node socket behind it (no peer) has no address to check.
    return undefined;
  }
}

export type DataLoader = (range: Period) => Promise<SpendingData>;

function failure(error: unknown): { status: 500 | 502; code: DataErrorCode } {
  if (error instanceof FireflyError) return { status: 502, code: error.reason };
  return { status: 500, code: "internal" };
}

export function createApp(options: {
  webDir: string;
  dev: boolean;
  loadData: DataLoader;
  log?: (message: string) => void;
}): Hono {
  const app = new Hono();
  const log = options.log ?? ((message: string) => console.error(message));

  app.use(async (c, next) => {
    if (!options.dev && !isIngress(peerAddress(c))) return c.text("Forbidden", 403);
    await next();
  });

  app.get("/api/health", (c) => c.json<Health>({ status: "ok", version: VERSION }));
  app.get("/api/data", async (c) => {
    const start = c.req.query("start");
    const end = c.req.query("end");
    if (!isDate(start) || !isDate(end) || start > end) {
      log("GET /api/data: bad-request");
      return c.json<DataError>({ error: "bad-request" }, 400);
    }
    try {
      return c.json<SpendingData>(await options.loadData({ start, end }));
    } catch (error) {
      const { status, code } = failure(error);
      // The reason and the error's name only: a message or a cause may carry a posting, an amount or the token.
      log(`GET /api/data: ${code}${code === "internal" && error instanceof Error ? ` (${error.name})` : ""}`);
      return c.json<DataError>({ error: code }, status);
    }
  });
  app.all("/api/*", (c) => c.notFound());

  const files = serveStatic({ root: options.webDir });
  app.get("/", files);
  app.get("/web/*", files);

  return app;
}
