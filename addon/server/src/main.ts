import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { VERSION } from "./version";

const PORT = 8099;

const dev = process.env.HA_SPENDING_DEV === "1";
const webDir = resolve(process.env.HA_SPENDING_WEB_DIR ?? "/opt/ha-spending/web");

serve({ fetch: createApp({ webDir, dev }).fetch, port: PORT }, () => {
  console.log(
    `Ha-Spending ${VERSION} listening on port ${PORT}, ingress check ${dev ? "off (HA_SPENDING_DEV=1)" : "on"}`,
  );
});
