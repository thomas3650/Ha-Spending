import type { Context } from "hono";
import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Health } from "@ha-spending/shared";
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

export function createApp(options: { webDir: string; dev: boolean }): Hono {
  const app = new Hono();

  app.use(async (c, next) => {
    if (!options.dev && !isIngress(peerAddress(c))) return c.text("Forbidden", 403);
    await next();
  });

  app.get("/api/health", (c) => c.json<Health>({ status: "ok", version: VERSION }));
  app.all("/api/*", (c) => c.notFound());

  const files = serveStatic({ root: options.webDir });
  app.get("/", files);
  app.get("/web/*", files);

  return app;
}
