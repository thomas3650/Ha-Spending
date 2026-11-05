import type { Context, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  type DataError,
  type DataErrorCode,
  type Health,
  type HiddenShopChange,
  type HiddenShops,
  type HiddenShopsError,
  type HiddenShopsErrorCode,
  isDate,
  type LeftOverData,
  type Period,
  type SpendingData,
} from "@ha-spending/shared";
import { FireflyError } from "./firefly/client";
import { HiddenShopsFull, type HiddenShopsStore, MAX_SHOP_NAME } from "./hidden-shops";
import { isIngress } from "./ingress";
import { logger } from "./log";
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
export type LeftOverLoader = (range: Period) => Promise<LeftOverData>;

function failure(error: unknown): { status: 500 | 502; code: DataErrorCode } {
  if (error instanceof FireflyError) return { status: 502, code: error.reason };
  return { status: 500, code: "internal" };
}

const MAX_CHANGE_BYTES = 1024;

function isShopName(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_SHOP_NAME) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function parseChange(text: string): HiddenShopChange | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const keys = Object.keys(body).sort();
  if (keys.length !== 2 || keys[0] !== "hidden" || keys[1] !== "shop") return null;
  const { shop, hidden } = body as Record<string, unknown>;
  if (!isShopName(shop) || typeof hidden !== "boolean") return null;
  return { shop, hidden };
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(";")[0].trim().toLowerCase() === "application/json";
}

export function createApp(options: {
  webDir: string;
  dev: boolean;
  loadData: DataLoader;
  loadLeftOver?: LeftOverLoader;
  hiddenShops: HiddenShopsStore;
  log?: (message: string) => void;
}): Hono {
  const app = new Hono();
  const log = options.log ?? ((message: string) => logger.error(message));

  app.use(async (c, next) => {
    if (!options.dev && !isIngress(peerAddress(c))) return c.text("Forbidden", 403);
    await next();
  });

  app.get("/api/health", (c) => c.json<Health>({ status: "ok", version: VERSION }));
  const answerRange = <T>(route: string, load: (range: Period) => Promise<T>) => async (c: Context) => {
    const start = c.req.query("start");
    const end = c.req.query("end");
    if (!isDate(start) || !isDate(end) || start > end) {
      log(`GET ${route}: bad-request`);
      return c.json<DataError>({ error: "bad-request" }, 400);
    }
    try {
      return c.json<T>(await load({ start, end }));
    } catch (error) {
      const { status, code } = failure(error);
      // The reason and the error's name only: a message or a cause may carry a posting, an amount or the token.
      log(`GET ${route}: ${code}${code === "internal" && error instanceof Error ? ` (${error.name})` : ""}`);
      return c.json<DataError>({ error: code }, status);
    }
  };
  app.get("/api/data", answerRange("/api/data", options.loadData));
  if (options.loadLeftOver) app.get("/api/left-over", answerRange("/api/left-over", options.loadLeftOver));

  const answerHiddenShops = (c: Context, shops: string[]) => {
    c.header("Cache-Control", "no-store");
    return c.json<HiddenShops>({ shops });
  };
  // The method, the route and the code only: never the shop.
  const hiddenShopsError = (c: Context, method: string, code: HiddenShopsErrorCode, status: 400 | 409 | 415 | 500) => {
    log(`${method} /api/hidden-shops: ${code}`);
    return c.json<HiddenShopsError>({ error: code }, status);
  };
  app.get("/api/hidden-shops", async (c) => {
    try {
      return answerHiddenShops(c, await options.hiddenShops.read());
    } catch {
      return hiddenShopsError(c, "GET", "internal", 500);
    }
  });
  app.post(
    "/api/hidden-shops",
    async (c, next) => {
      if (!isJson(c.req.header("Content-Type"))) return hiddenShopsError(c, "POST", "unsupported", 415);
      await next();
    },
    bodyLimit({ maxSize: MAX_CHANGE_BYTES, onError: (c) => hiddenShopsError(c, "POST", "bad-request", 400) }),
    async (c) => {
      const change = parseChange(await c.req.text());
      if (change === null) return hiddenShopsError(c, "POST", "bad-request", 400);
      try {
        return answerHiddenShops(c, await options.hiddenShops.set(change.shop, change.hidden));
      } catch (error) {
        if (error instanceof HiddenShopsFull) return hiddenShopsError(c, "POST", "full", 409);
        return hiddenShopsError(c, "POST", "internal", 500);
      }
    },
  );
  app.all("/api/*", (c) => c.notFound());

  const files = serveStatic({ root: options.webDir });
  const cacheOnSuccess = (value: string): MiddlewareHandler => async (c, next) => {
    await next();
    if (c.res.status === 200) c.res.headers.set("Cache-Control", value);
  };
  app.get("/", cacheOnSuccess("no-cache"), files);
  app.get("/web/*", cacheOnSuccess("public, max-age=31536000, immutable"), files);

  return app;
}
