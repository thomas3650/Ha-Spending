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
      sorter_key: "k".repeat(32),
      sorter_inbox_category: "Indbakke",
    });
    expect(readOptions(path)).toEqual({
      fireflyUrl: "http://firefly.test:8080",
      fireflyToken: "t0ken-made-up",
      fireflyLinkUrl: "http://firefly.test",
      mainGroupRuleGroup: "Grupper",
      excludedMainGroups: ["A", "B"],
      sorterKey: "k".repeat(32),
      sorterInboxCategory: "Indbakke",
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
      sorterKey: null,
      sorterInboxCategory: "Til sortering",
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

  it("refuses options of the wrong shape", () => {
    const base = { firefly_url: "http://firefly.test", firefly_token: "t0ken-made-up" };
    expect(refusal(file(["not", "an", "object"])).message).toContain("options.json");
    expect(refusal(file({ ...base, firefly_link_url: 42 })).message).toContain("firefly_link_url");
    expect(refusal(file({ ...base, excluded_main_groups: "A" })).message).toContain("excluded_main_groups");
    expect(refusal(file({ ...base, excluded_main_groups: ["A", 1] })).message).toContain("excluded_main_groups");
  });

  it("reads an empty rule group as the default", () => {
    const path = file({ firefly_url: "http://firefly.test", firefly_token: "t0ken-made-up", main_group_rule_group: "" });
    expect(readOptions(path).mainGroupRuleGroup).toBe("Hovedgrupper");
  });

  it("reads an empty sorter key as none", () => {
    const path = file({ firefly_url: "http://firefly.test", firefly_token: "t0ken-made-up", sorter_key: "" });
    expect(readOptions(path).sorterKey).toBeNull();
  });

  it("refuses a short sorter key without showing it, and an inbox name with a double quote", () => {
    const base = { firefly_url: "http://firefly.test", firefly_token: "t0ken-made-up" };
    const short = refusal(file({ ...base, sorter_key: "short-made-up-key" }));
    expect(short.message).toContain("sorter_key");
    expect(short.message).not.toContain("short-made-up-key");
    expect(refusal(file({ ...base, sorter_inbox_category: 'Til "sortering"' })).message).toContain(
      "sorter_inbox_category",
    );
  });
});
