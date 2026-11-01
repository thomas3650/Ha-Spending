import { describe, expect, it } from "vitest";
import { generateSeed } from "../src/generate";

const s = generateSeed({ today: "2026-10-30", seed: 1 });
const splits = s.transactions.flatMap((t) => t.splits);
const rules = s.ruleGroups.find((g) => g.title === "Hovedgrupper")!.rules;
const mapped = rules.flatMap((r) =>
  r.triggers.filter((t) => t.type === "category_is").map((t) => t.value),
);

describe("generateSeed", () => {
  it("is the same for the same seed", () => {
    expect(generateSeed({ today: "2026-10-30", seed: 1 })).toEqual(s);
    expect(generateSeed({ today: "2026-10-30", seed: 2 })).not.toEqual(s);
  });

  it("spans 14 months up to today", () => {
    const dates = splits.map((x) => x.date).sort();
    expect(dates[0] >= "2025-08-01").toBe(true);
    expect(dates[0] < "2025-08-15").toBe(true);
    expect(dates.at(-1)! <= "2026-10-30").toBe(true);
  });

  it("covers every screen", () => {
    const tags = new Set(rules.flatMap((r) => r.actions.filter((a) => a.type === "add_tag").map((a) => a.value)));
    tags.delete("Penge ind og ud");
    expect(tags.size).toBeGreaterThan(8);

    expect(splits.some((x) => x.type === "deposit" && x.category && !["Indskud", "Opsparing"].includes(x.category)))
      .toBe(true);
    expect(splits.some((x) => x.type === "transfer")).toBe(true);
    expect(splits.some((x) => x.type === "withdrawal" && !x.category)).toBe(true);
    expect(s.categories.some((c) => !mapped.includes(c))).toBe(true);
    expect(s.accounts).toHaveLength(3);
    expect(s.transactions.some((t) => t.splits.length === 2)).toBe(true);
    expect(splits.some((x) => x.foreignAmount)).toBe(true);
    expect(mapped.some((c, i) => mapped.indexOf(c) !== i)).toBe(true);
  });

  it("names only accounts and categories it lists", () => {
    const assets = s.accounts.map((a) => a.name);
    for (const x of splits) {
      if (x.type !== "deposit") expect(assets).toContain(x.source);
      if (x.type !== "withdrawal") expect(assets).toContain(x.destination);
      if (x.category) expect(s.categories).toContain(x.category);
    }
  });

  it("has a quarterly, a yearly, a weekly and an every-second-month subscription", () => {
    const subs = s.subscriptions ?? [];
    expect(subs.some((x) => x.repeat === "quarterly")).toBe(true);
    expect(subs.some((x) => x.repeat === "yearly")).toBe(true);
    expect(subs.some((x) => x.repeat === "weekly")).toBe(true);
    expect(subs.some((x) => x.repeat === "monthly" && x.skip === 1)).toBe(true);
  });

  it("links only to subscriptions it lists", () => {
    const names = (s.subscriptions ?? []).map((x) => x.name);
    const linked = splits.filter((x) => x.subscription !== undefined);
    expect(linked.length).toBeGreaterThan(0);
    for (const x of linked) expect(names).toContain(x.subscription);
  });
});
