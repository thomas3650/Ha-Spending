import { describe, expect, it } from "vitest";
import { serverEnv } from "../src/env";

describe("serverEnv", () => {
  it("binds everything in the add-on", () => {
    expect(serverEnv({})).toEqual({
      dev: false,
      webDir: "/opt/ha-spending/web",
      optionsPath: "/data/options.json",
      hiddenShopsPath: "/data/hidden-shops.json",
      hostname: undefined,
    });
  });

  it("binds 127.0.0.1 in the fast loop", () => {
    expect(serverEnv({ HA_SPENDING_DEV: "1", HA_SPENDING_OPTIONS: "/x.json" })).toEqual({
      dev: true,
      webDir: "/opt/ha-spending/web",
      optionsPath: "/x.json",
      hiddenShopsPath: "/data/hidden-shops.json",
      hostname: "127.0.0.1",
    });
  });

  it("hiddenShopsPath defaults to /data/hidden-shops.json and follows HA_SPENDING_HIDDEN_SHOPS", () => {
    expect(serverEnv({}).hiddenShopsPath).toBe("/data/hidden-shops.json");
    expect(serverEnv({ HA_SPENDING_HIDDEN_SHOPS: "/y/hidden.json" }).hiddenShopsPath).toBe("/y/hidden.json");
  });
});
