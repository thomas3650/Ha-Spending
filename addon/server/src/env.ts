import { resolve } from "node:path";

export function serverEnv(env: Record<string, string | undefined>): {
  dev: boolean;
  webDir: string;
  optionsPath: string;
  hostname: string | undefined;
} {
  const dev = env.HA_SPENDING_DEV === "1";
  return {
    dev,
    webDir: resolve(env.HA_SPENDING_WEB_DIR ?? "/opt/ha-spending/web"),
    optionsPath: env.HA_SPENDING_OPTIONS ?? "/data/options.json",
    // The fast loop's server holds a token, so on the Mac it answers this machine only (D13).
    hostname: dev ? "127.0.0.1" : undefined,
  };
}
