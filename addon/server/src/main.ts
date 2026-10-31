import { serve } from "@hono/node-server";
import { localToday, type SpendingData } from "@ha-spending/shared";
import { createApp, type DataLoader } from "./app";
import { createCache } from "./cache";
import { serverEnv } from "./env";
import { createFireflyClient, FireflyError } from "./firefly/client";
import { READ_TIMEOUT_MS, type ReadSettings, readSpendingData, readVersion } from "./firefly/read";
import { type Options, OptionsError, readOptions } from "./options";
import { VERSION } from "./version";

const PORT = 8099;

const env = serverEnv(process.env);

let options: Options;
try {
  options = readOptions(env.optionsPath);
} catch (error) {
  if (!(error instanceof OptionsError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const client = createFireflyClient({ baseUrl: options.fireflyUrl, token: options.fireflyToken });
const settings: ReadSettings = {
  mainGroupRuleGroup: options.mainGroupRuleGroup,
  excludedMainGroups: options.excludedMainGroups,
  fireflyLinkUrl: options.fireflyLinkUrl,
  pageSize: 500,
  timeoutMs: READ_TIMEOUT_MS,
};
const cache = createCache<SpendingData>({ ttlMs: 300_000, max: 20 });
const loadData: DataLoader = (range) =>
  cache.get(`${range.start}|${range.end}`, () =>
    readSpendingData(client, settings, range, { today: localToday(new Date()), warn: console.warn }),
  );

const app = createApp({ webDir: env.webDir, dev: env.dev, loadData });

serve({ fetch: app.fetch, port: PORT, hostname: env.hostname }, () => {
  console.log(
    `Ha-Spending ${VERSION} listening on ${env.hostname ?? "all addresses"}, port ${PORT}, ` +
      `ingress check ${env.dev ? "off (HA_SPENDING_DEV=1)" : "on"}`,
  );
  readVersion(client).then(
    (version) => console.log(`Firefly III ${version}`),
    (error: unknown) =>
      console.error(`Firefly III's version not read: ${error instanceof FireflyError ? error.reason : "internal"}`),
  );
});
