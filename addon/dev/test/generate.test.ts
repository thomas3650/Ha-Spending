import { describe, expect, it } from "vitest";
import { subscriptionStatus, type Subscription } from "@ha-spending/shared";
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
    expect(s.accounts).toHaveLength(4);
    expect(s.transactions.some((t) => t.splits.length === 2)).toBe(true);
    expect(splits.some((x) => x.foreignAmount)).toBe(true);
    expect(mapped.some((c, i) => mapped.indexOf(c) !== i)).toBe(true);
  });

  it("has a household for Til overs", () => {
    expect(splits.some((x) => x.type === "deposit" && x.source === "Anna")).toBe(true);
    expect(splits.some((x) => x.type === "deposit" && x.source === "Bo")).toBe(true);
    expect(splits.some((x) => x.type === "transfer" && x.source === "Kassekredit")).toBe(true);
    expect(splits.some((x) => x.type === "withdrawal" && x.destination === "Anna")).toBe(true);
    expect(splits.some((x) => x.type === "withdrawal" && x.destination === "Billån")).toBe(true);
    expect(s.otherAccounts).toContainEqual({ name: "Billån", type: "liabilities", active: true });
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

  it("has a subscription whose payment is expected with a date before today", () => {
    const seeded = (s.subscriptions ?? []).find((x) => x.name === "Fitnessabonnement")!;
    const last = splits.filter((x) => x.subscription === seeded.name).sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
    const øre = (amount: string) => Math.round(Number(amount) * 100);
    const subscription: Subscription = {
      id: "1",
      name: seeded.name,
      repeat: seeded.repeat,
      skip: seeded.skip ?? 0,
      start: seeded.start,
      end: null,
      amountMin: øre(seeded.amountMin),
      amountMax: øre(seeded.amountMax),
      objectGroup: seeded.objectGroup ?? "",
      lastPayment: { date: last.date, amount: øre(last.amount), category: last.category ?? null, account: last.source },
    };
    const status = subscriptionStatus(subscription, "2026-10-30");
    expect(status.kind).toBe("expected");
    if (status.kind === "expected") expect(status.date! < "2026-10-30").toBe(true);
  });

  it("puts bills in both object groups and leaves one without", () => {
    const group = (name: string) => (s.subscriptions ?? []).find((x) => x.name === name)?.objectGroup;
    expect(group("Netflix")).toBe("Abonnementer");
    expect(group("Spotify")).toBe("Abonnementer");
    expect(group("Husleje")).toBe("Faste udgifter");
    expect(group("Havehjælp")).toBeUndefined();
  });

  it("has a bill that ended at a month's end, one that ended mid-month, and a yearly one paid earlier this year", () => {
    const sub = (name: string) => (s.subscriptions ?? []).find((x) => x.name === name)!;
    const paid = (name: string) => splits.filter((x) => x.subscription === name).map((x) => x.date).sort();
    expect(sub("Avisabonnement")).toMatchObject({ repeat: "monthly", end: "2026-08-31", active: false, objectGroup: "Faste udgifter" });
    expect(paid("Avisabonnement").length).toBeGreaterThan(0);
    expect(paid("Avisabonnement").at(-1)! <= "2026-08-31").toBe(true);
    expect(sub("Tidsskrift")).toMatchObject({ repeat: "monthly", end: "2026-09-15", objectGroup: "Abonnementer" });
    expect(paid("Tidsskrift").at(-1)! <= "2026-09-15").toBe(true);
    expect(sub("Vejhjælp")).toMatchObject({ repeat: "yearly", objectGroup: "Faste udgifter" });
    expect(paid("Vejhjælp")).toEqual(["2026-05-10"]);
  });
});
