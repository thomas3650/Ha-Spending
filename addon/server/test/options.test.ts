import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OptionsError, readOptions } from "../src/options";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ha-spending-options-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function file(content: unknown): string {
  const path = join(dir, "options.json");
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

function refusal(path: string): OptionsError {
  try {
    readOptions(path);
  } catch (error) {
    expect(error).toBeInstanceOf(OptionsError);
    return error as OptionsError;
  }
  throw new Error("readOptions did not throw");
}

describe("readOptions", () => {
  it("reads every option", () => {
    const path = file({
      firefly_url: "http://firefly.test:8080/",
      firefly_token: "t0ken-made-up",
      firefly_link_url: "http://firefly.test/",
      main_group_rule_group: "Grupper",
      excluded_main_groups: ["A", "B"],
    });
    expect(readOptions(path)).toEqual({
      fireflyUrl: "http://firefly.test:8080",
      fireflyToken: "t0ken-made-up",
      fireflyLinkUrl: "http://firefly.test",
      mainGroupRuleGroup: "Grupper",
      excludedMainGroups: ["A", "B"],
    });
  });

  it("fills the defaults", () => {
    const path = file({ firefly_url: "http://firefly.test:8080", firefly_token: "t0ken-made-up" });
    expect(readOptions(path)).toEqual({
      fireflyUrl: "http://firefly.test:8080",
      fireflyToken: "t0ken-made-up",
      fireflyLinkUrl: null,
      mainGroupRuleGroup: "Hovedgrupper",
      excludedMainGroups: ["Penge ind og ud"],
    });
  });

  it("reads an empty link address as none", () => {
    const path = file({ firefly_url: "http://firefly.test", firefly_token: "t0ken-made-up", firefly_link_url: "" });
    expect(readOptions(path).fireflyLinkUrl).toBeNull();
  });

  it("refuses a missing url or token without showing the token", () => {
    expect(refusal(file({ firefly_url: "http://firefly.test" })).message).toContain("firefly_token");

    const empty = refusal(file({ firefly_url: "", firefly_token: "sekret-made-up" }));
    expect(empty.message).toContain("firefly_url");
    expect(empty.message).not.toContain("sekret-made-up");

    const broken = refusal(file('{"firefly_url": "http://firefly.test", "firefly_token": "sekret-made-up"'));
    expect(broken.message).not.toContain("sekret-made-up");

    const missing = join(dir, "nothing.json");
    const none = refusal(missing);
    expect(none.message).toContain(missing);
    expect(none.message).toContain("firefly_url");
    expect(none.message).toContain("firefly_token");
  });
});
